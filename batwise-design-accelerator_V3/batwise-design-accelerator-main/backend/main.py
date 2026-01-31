import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
import os
import json
import csv
import io
from dotenv import load_dotenv

# Importar Modelos
from models import Requirements, ContactRequest, DesignResponse, CellData

# Importar Lógica e DB Padrão
from logic import compute_cell_configurations
from database import db

app = FastAPI(title="BatteryApp Calculator API")

# Configurar CORS (Para o teu frontend no Vercel conseguir falar com este backend)
origins = [
    "http://localhost:8080",  # Localhost
    "http://localhost:5173",
    # O teu URL do Vercel (ajusta se for diferente)
    "https://www.watt-builder.com",
    "https://batwise.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FUNÇÃO AUXILIAR PARA PARSAR CSV ---


def parse_csv_file(file_content: bytes) -> List[Dict]:
    """
    Lê bytes de um CSV, deteta números e converte-os de string para float/int.
    """
    try:
        # Descodificar bytes para string (tenta lidar com Excel BOM utf-8-sig)
        content_str = file_content.decode("utf-8-sig")

        # Ler CSV
        csv_reader = csv.DictReader(io.StringIO(content_str))

        parsed_data = []
        for row in csv_reader:
            clean_row = {}
            for key, value in row.items():
                if value is None:
                    continue

                # Tentar converter números
                try:
                    # Tenta converter para float
                    if "." in value:
                        clean_row[key] = float(value)
                    else:
                        clean_row[key] = int(value)
                except ValueError:
                    # Se falhar, mantém como string (mas remove espaços extra)
                    clean_row[key] = value.strip()

            parsed_data.append(clean_row)

        return parsed_data
    except Exception as e:
        print(f"Erro a ler CSV: {str(e)}")
        return []


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
async def calculate_endpoint(
    # Recebe a config como string JSON dentro do Form Data
    config: str = Form(...),
    use_custom_db: str = Form("false"),
    # Recebe os ficheiros (opcionais)
    cells: Optional[UploadFile] = File(None),
    bms: Optional[UploadFile] = File(None),
    relays: Optional[UploadFile] = File(None),
    fuses: Optional[UploadFile] = File(None),
    shunts: Optional[UploadFile] = File(None),
    cables: Optional[UploadFile] = File(None)
):

    try:
        # 1. Converter a string JSON de volta para o objeto Requirements
        config_dict = json.loads(config)
        req = Requirements(**config_dict)

        # Variáveis para a base de dados a usar nesta execução
        active_cells = []
        active_components = {}

        # 2. Decidir qual base de dados usar
        if use_custom_db.lower() == 'true':
            # --- MODO CUSTOM: Ler ficheiros enviados ---
            print("📂 Modo Custom DB detetado. A processar ficheiros...")
            req.use_custom_db = True
            # Processar Células (Obrigatório segundo o frontend)
            if cells:
                cells_raw = parse_csv_file(await cells.read())
                # Validar e converter para objetos CellData
                # (Isto filtra linhas inválidas automaticamente)
                for c in cells_raw:
                    try:
                        active_cells.append(CellData(**c))
                    except Exception as e:
                        print(f"Skipping invalid custom cell: {e}")
            else:
                # Se o utilizador não enviou células, não dá para calcular
                return DesignResponse(results=[], plotResults=[], total=0, stats={"error": "No cells uploaded"})

            # Processar Componentes
            active_components = {
                "fuses": parse_csv_file(await fuses.read()) if fuses else [],
                "relays": parse_csv_file(await relays.read()) if relays else [],
                "shunts": parse_csv_file(await shunts.read()) if shunts else [],
                "bms": parse_csv_file(await bms.read()) if bms else [],
                "cables": parse_csv_file(await cables.read()) if cables else [],
            }

        else:
            print("📂 Modo Default DB detetado.")

            # --- MODO DEFAULT: Usar a base de dados interna ---
            active_cells = db.cells
            active_components = db.components

        # 3. Executar o cálculo com os dados selecionados
        res = compute_cell_configurations(
            req,
            active_cells,
            active_components
        )

        return res

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400, detail="Configuração JSON inválida")
    except Exception as e:
        import traceback
        traceback.print_exc()
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


load_dotenv()
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
