import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
import os
import json
import csv
import io
from dotenv import load_dotenv
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
import security

# Importar Modelos
from models import Requirements, ContactRequest, DesignResponse, CellData, UserCreate, UserLogin, Token, UserResponse
import tables  # Importar para criar as tabelas

# Importar Lógica e DB Padrão
from logic import compute_cell_configurations
from database import db, engine, SessionLocal

from sqlalchemy.orm import Session


tables.Base.metadata.create_all(bind=engine)

app = FastAPI(title="BatteryApp Calculator API")

# Configurar CORS (Para o teu frontend no Vercel conseguir falar com este backend)
origins = [
    "http://localhost:8080",  # Localhost
    "http://localhost:5173",
    # O teu URL do Vercel (ajusta se for diferente)
    "https://www.watt-builder.com",
    "https://www.preview.watt-builder.com"
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


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Dependency para obter o user logado a partir do Token


def get_db():
    db_session = SessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, security.SECRET_KEY,
                             algorithms=[security.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = db.query(tables.User).filter(tables.User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- NOVO ENDPOINT: Deduzir Créditos ---


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
    config: str = Form(...),
    use_custom_db: str = Form("false"),
    cells: Optional[UploadFile] = File(None),
    bms: Optional[UploadFile] = File(None),
    relays: Optional[UploadFile] = File(None),
    fuses: Optional[UploadFile] = File(None),
    shunts: Optional[UploadFile] = File(None),
    cables: Optional[UploadFile] = File(None),
    # Injetar a DB e o Header de Autenticação
    db_session: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    try:
        # 1. Parse da Configuração
        config_dict = json.loads(config)
        req = Requirements(**config_dict)

        # Variáveis para a DB
        active_cells = []
        active_components = {}
        is_custom_run = use_custom_db.lower() == 'true'

        # 2. Carregar Dados (Custom ou Default)
        if is_custom_run:
            print("📂 Modo Custom DB detetado.")
            req.use_custom_db = True

            # (Lógica de ficheiros igual à anterior...)
            if cells:
                cells_raw = parse_csv_file(await cells.read())
                for c in cells_raw:
                    try:
                        active_cells.append(CellData(**c))
                    except Exception as e:
                        print(f"Skipping invalid custom cell: {e}")
            else:
                return DesignResponse(results=[], plotResults=[], total=0, stats={"error": "No cells uploaded"})

            active_components = {
                "fuses": parse_csv_file(await fuses.read()) if fuses else [],
                "relays": parse_csv_file(await relays.read()) if relays else [],
                "shunts": parse_csv_file(await shunts.read()) if shunts else [],
                "bms": parse_csv_file(await bms.read()) if bms else [],
                "cables": parse_csv_file(await cables.read()) if cables else [],
            }
        else:
            print("📂 Modo Default DB detetado.")
            active_cells = db.cells
            active_components = db.components

        # 3. Executar o Cálculo
        res_dict = compute_cell_configurations(
            req, active_cells, active_components)

        # --- LÓGICA DE DEDUÇÃO DE CRÉDITOS ---
        remaining = None

        # Só cobramos se:
        # a) For Custom DB
        # b) Tiver gerado pelo menos 2 resultados
        if is_custom_run and res_dict["total"] >= 2:
            if not authorization:
                raise HTTPException(
                    status_code=401, detail="Authentication required for Custom DB")

            try:
                # Extrair o Token (Remove "Bearer ")
                token = authorization.split(" ")[1]
                payload = jwt.decode(token, security.SECRET_KEY, algorithms=[
                                     security.ALGORITHM])
                email: str = payload.get("sub")

                # Buscar User e Deduzir
                user = db_session.query(tables.User).filter(
                    tables.User.email == email).first()

                if user:
                    if user.credits > 0:
                        user.credits -= 1
                        db_session.commit()
                        remaining = user.credits
                        print(f"💰 Crédito deduzido. Restantes: {remaining}")
                    else:
                        # Se chegou aqui com 0 créditos (backend check final)
                        raise HTTPException(
                            status_code=403, detail="Insufficient credits")

            except (JWTError, IndexError):
                raise HTTPException(status_code=401, detail="Invalid token")

        # Adicionar créditos restantes à resposta
        res_dict["remaining_credits"] = remaining

        return res_dict

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400, detail="Configuração JSON inválida")
    except HTTPException as he:
        raise he
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


# --- ROTAS DE AUTH ---


@app.post("/auth/signup", response_model=UserResponse)
def signup(user: UserCreate, db_session: Session = Depends(get_db)):
    # Verificar se email existe
    db_user = db_session.query(tables.User).filter(
        tables.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Criar User
    hashed_pwd = security.get_password_hash(user.password)
    new_user = tables.User(
        email=user.email,
        full_name=user.full_name,
        company=user.company,
        hashed_password=hashed_pwd,
        credits=5  # Define aqui quantos créditos iniciais queres dar
    )

    db_session.add(new_user)
    db_session.commit()
    db_session.refresh(new_user)

    return new_user


@app.post("/auth/login", response_model=Token)
def login(creds: UserLogin, db_session: Session = Depends(get_db)):
    user = db_session.query(tables.User).filter(
        tables.User.email == creds.email).first()

    if not user or not security.verify_password(creds.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Criar token
    access_token = security.create_access_token(
        data={"sub": user.email}
    )

    # Retorna token e info extra (créditos)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_name": user.full_name,
        "credits": user.credits
    }


@app.post("/auth/deduct-credit")
def deduct_credit(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.credits <= 0:
        raise HTTPException(status_code=403, detail="Insufficient credits")

    current_user.credits -= 1
    db.commit()

    return {"remaining_credits": current_user.credits}


if __name__ == "__main__":
    # Corre o servidor na porta 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
