from dynamodb_handler import DynamoDBUserHandler
from logic import compute_cell_configurations
from models import Requirements, ContactRequest, DesignResponse, CellData, UserCreate, UserLogin, Token, UserResponse
import security
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
import os
import json
import csv
import io
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from mangum import Mangum
from cells_loader import Database
from datetime import datetime, timedelta
import pytz

# Carregar variáveis de ambiente antes de importar módulos que dependem delas
from env_loader import load_backend_env

load_backend_env()


# Importar Modelos

# Importar Lógica e DB de Células

# Adicionar path para importar DynamoDB handler

db_users = DynamoDBUserHandler()

app = FastAPI(title="BatteryApp Calculator API")

# Configurar CORS (Para o teu frontend no Vercel conseguir falar com este backend)
origins = [
    "http://localhost:8080",  # Localhost
    "http://127.0.0.1:8080",  # Localhost via IP
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",  # Vite dev server via IP
    # O teu URL do Vercel (ajusta se for diferente)
    "https://www.watt-builder.com",
    "https://www.preview.watt-builder.com",
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


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def check_trial_status(user: dict):
    """
    Verifica se o user está em trial e se já passaram 15 dias.
    Se expirou, coloca os créditos a 0.
    """
    if user.get("trial_started_at") and user.get("credits") > 0:
        # Converter string ISO para objeto datetime
        try:
            start_date = datetime.fromisoformat(user["trial_started_at"])

            # Adicionar info de timezone se necessário (assumindo UTC)
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=None)

            now = datetime.utcnow()

            # Verificar se passaram 15 dias
            if now > (start_date + timedelta(days=15)):
                print(
                    f"🚫 Trial expirado para {user['email']}. Removendo créditos.")
                # Chamar DynamoDB para zerar créditos
                db_users.update_user_credits(user['email'], 0)
                user['credits'] = 0  # Atualizar objeto local
        except ValueError:
            pass  # Data inválida, ignorar

    return user


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, security.SECRET_KEY,
                             algorithms=[security.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = db_users.get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    user = check_trial_status(user)
    return user

# --- NOVO ENDPOINT: Deduzir Créditos ---


@app.get("/")
def read_root():
    """Endpoint de saúde para verificar se os dados carregaram bem."""
    return {
        "status": "Operational 🚀"
    }


@app.get("/cells", response_model=List[CellData])
def get_all_cells():
    """
    Retorna a lista completa de células disponíveis na base de dados.
    O Frontend usa isto para popular a página 'Cell Explorer'.
    """
    db = Database()

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
    # Injetar o Header de Autenticação
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
            db = Database()
            active_cells = db.cells
            active_components = db.components

        # 3. Executar o Cálculo
        res_dict = compute_cell_configurations(
            req, active_cells, active_components)

        # --- LÓGICA DE DEDUÇÃO DE CRÉDITOS ---
        remaining = None

        # Só cobramos se:
        # a) Tiver gerado pelo menos 2 resultados
        if res_dict["total"] >= 2:
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
                user = db_users.get_user_by_email(email)

                if user:
                    if user['credits'] > 0:
                        remaining = db_users.deduct_credit(email)
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
def signup(user: UserCreate):
    # Verificar se email existe
    if db_users.user_exists(user.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    # Criar User
    hashed_pwd = security.get_password_hash(user.password)
    try:
        new_user = db_users.create_user(
            email=user.email,
            full_name=user.full_name,
            company=user.company,
            hashed_password=hashed_pwd,
            credits=5  # Define aqui quantos créditos iniciais queres dar
        )
        return new_user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/login", response_model=Token)
def login(creds: UserLogin):
    user = db_users.get_user_by_email(creds.email)

    if not user or not security.verify_password(creds.password, user['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Criar token
    access_token = security.create_access_token(
        data={"sub": user['email']}
    )

    # Retorna token e info extra (créditos)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_name": user['full_name'],
        "credits": user['credits'],
        "trial_started_at": user.get('trial_started_at')
    }


@app.post("/auth/deduct-credit")
def deduct_credit(current_user: dict = Depends(get_current_user)):
    if current_user['credits'] <= 0:
        raise HTTPException(status_code=403, detail="Insufficient credits")

    try:
        remaining = db_users.deduct_credit(current_user['email'])
        return {"remaining_credits": remaining}
    except ValueError:
        raise HTTPException(status_code=403, detail="Insufficient credits")


# No endpoint activate_trial
@app.post("/auth/activate-trial", response_model=UserResponse)
def activate_trial(current_user: dict = Depends(get_current_user)):
    # 1. Verificar se já ativou
    if current_user.get("trial_started_at"):
        raise HTTPException(
            status_code=400,
            detail="Free trial already activated or used."
        )

    # 2. Ativar
    try:
        now_iso = datetime.utcnow().isoformat()

        # Esta função devolve o dict atualizado do DynamoDB
        updated_attributes = db_users.activate_trial_for_user(
            email=current_user['email'],
            start_date=now_iso,
            bonus_credits=1000
        )

        # FastAPI usa o response_model=UserResponse para filtrar este dict.
        # Como atualizaste o models.py no passo 1, o campo 'trial_started_at'
        # agora vai passar para o frontend.
        return updated_attributes

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


handler = Mangum(app)

if __name__ == "__main__":
    # Corre o servidor na porta definida no .env (default 8000)
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
