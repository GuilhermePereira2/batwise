import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
import os

# Importar Modelos (Inputs/Outputs)
from models import Requirements, ContactRequest, DesignResponse, CellData

# Importar Lógica de Cálculo
from logic import compute_cell_configurations

# --- A GRANDE MUDANÇA ESTÁ AQUI ---
# Em vez de importar listas, importamos a nossa "Base de Dados" viva
from database import db

app = FastAPI(title="BatteryApp Calculator API")

# Configurar CORS (Para o teu frontend no Vercel conseguir falar com este backend)
origins = [
    "http://localhost:5173",  # Localhost
    # O teu URL do Vercel (ajusta se for diferente)
    "https://www.watt-builder.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    """Endpoint de saúde para verificar se os dados carregaram bem."""
    return {
        "status": "Operational 🚀",
        "database_stats": {
            "cells": len(db.cells),
            "fuses": len(db.components.get("fuses", [])),
            "relays": len(db.components.get("relays", [])),
            "cables": len(db.components.get("cables", []))
        }
    }


@app.get("/cells", response_model=List[CellData])
def get_all_cells():
    """
    Retorna a lista completa de células disponíveis na base de dados.
    O Frontend usa isto para popular a página 'Cell Explorer'.
    """
    if not db.cells:
        # Opcional: Retornar lista vazia ou erro se não houver dados
        return []
    return db.cells


@app.post("/calculate", response_model=DesignResponse)
def calculate_endpoint(req: Requirements):
    try:
        res = compute_cell_configurations(
            req,
            db.cells,
            db.components
        )

        return res

    except Exception as e:
        import traceback
        print("❌ Erro crítico no cálculo:")
        traceback.print_exc()   # <---- ATIVAR LOGGING AQUI
        raise HTTPException(status_code=500, detail=str(e))


# --- Endpoint Bónus: Recarregar Dados sem desligar o servidor ---


@app.post("/admin/reload-data")
def reload_data():
    """
    Útil para quando editares o ficheiro .json e quiseres atualizar
    os dados sem ter de parar e arrancar o python.
    """
    try:
        db.reload()
        return {"message": "Base de dados recarregada com sucesso!", "stats": len(db.cells)}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao recarregar: {str(e)}")


# 2. Configuração do Servidor de Email (Lê das variáveis de ambiente)
# Se usares Gmail, precisas de criar uma "App Password" na conta Google
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),  # Zoho usa 465 para SSL
    # Ou .com se a tua conta for global
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.zoho.eu"),
    MAIL_STARTTLS=True,  # Desativar para Porta 465
    MAIL_SSL_TLS=False,   # Ativar para Porta 465
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

# 3. Endpoint para enviar o email


@app.post("/send-contact-email")
async def send_contact_email(contact: ContactRequest):
    try:
        # Corpo do email que Vais receber
        email_body = f"""
        <h1>Nova Mensagem do Site</h1>
        <p><strong>Nome:</strong> {contact.name}</p>
        <p><strong>Email:</strong> {contact.email}</p>
        <hr>
        <p><strong>Mensagem:</strong></p>
        <p>{contact.message}</p>
        """

        message = MessageSchema(
            subject=f"WattBuilder Contacto: {contact.name}",
            recipients=["general@watt-builder.com"],  # O TEU EMAIL AQUI
            body=email_body,
            subtype=MessageType.html
        )

        fm = FastMail(conf)
        await fm.send_message(message)

        return {"message": "Email enviado com sucesso"}

    except Exception as e:
        print(f"Erro ao enviar email: {e}")
        raise HTTPException(status_code=500, detail="Falha ao enviar email")

if __name__ == "__main__":
    # Corre o servidor na porta 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
