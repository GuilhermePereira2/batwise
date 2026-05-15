import token
from urllib import request
from dynamodb_handler import DynamoDBUserHandler
from logic import compute_cell_configurations
from models import SimulatorRequest, Requirements, PasswordResetConfirm, PasswordResetRequest, ContactRequest, DesignResponse, CellData, UserCreate, UserLogin, GoogleLogin, Token, UserResponse
import security
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import ValidationError
from botocore.exceptions import NoCredentialsError, ClientError
import os
import json
import csv
import io
import sqlite3
from html import escape
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from mangum import Mangum
from cells_loader import Database
from datetime import datetime, timedelta
import uuid
from HomeBatterys.optimizer import optimize_home_battery

# Carregar variáveis de ambiente antes de importar módulos que dependem delas
from env_loader import load_backend_env

load_backend_env()


# Importar Modelos

# Importar Lógica e DB de Células

# Adicionar path para importar DynamoDB handler

db_users = DynamoDBUserHandler()

app = FastAPI(title="BatteryApp Calculator API")


@app.on_event("startup")
def check_home_catalog_on_startup():
    validate_sqlite_home_catalog()


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
    Admin users não expiram.
    """
    # Admin users não expiram
    if user.get("admin"):
        return user

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
                    status_code=401, detail="Authentication required")

            try:
                # Extrair o Token (Remove "Bearer ")
                token = authorization.split(" ")[1]
                payload = jwt.decode(token, security.SECRET_KEY, algorithms=[
                                     security.ALGORITHM])
                email: str = payload.get("sub")

                # Buscar utilizador para validar que o token pertence a uma conta ativa.
                user = db_users.get_user_by_email(email)

                if not user:
                    raise HTTPException(
                        status_code=401, detail="User not found")

                print(
                    f"Creditos ilimitados para {email}. Sem deducao de creditos.")

            except (JWTError, IndexError):
                raise HTTPException(status_code=401, detail="Invalid token")

        # Adicionar créditos restantes à resposta
        res_dict["remaining_credits"] = remaining

        return res_dict

    except ValidationError as ve:
        # Erro de validação do Pydantic (campos obrigatórios faltando)
        error_messages = []
        for error in ve.errors():
            field = error['loc'][-1] if error['loc'] else 'unknown'
            msg = error['msg']
            error_messages.append(f"{field}: {msg}")

        error_detail = "Missing or invalid required fields: " + \
            ", ".join(error_messages)
        raise HTTPException(status_code=422, detail=error_detail)
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
mail_from = os.getenv("MAIL_FROM", "general@watt-builder.com")
mail_from_name = "WattBuilder"

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=mail_from,
    MAIL_FROM_NAME=mail_from_name,
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),  # Zoho usa 465 para SSL
    # Ou .com se a tua conta for global
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.zoho.eu"),
    MAIL_STARTTLS=True,  # Desativar para Porta 465
    MAIL_SSL_TLS=False,   # Ativar para Porta 465
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    SUPPRESS_SEND=False
)

# 3. Endpoint para enviar o email


@app.post("/send-contact-email")
async def send_contact_email(contact: ContactRequest):
    try:
        safe_name = escape(contact.name)
        safe_email = escape(str(contact.email))
        safe_subject = escape((contact.subject or f"WattBuilder Contacto: {contact.name}").strip())
        message_html = escape(contact.message).replace("\n", "<br>")

        # Corpo do email que Vais receber
        email_body = f"""
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 720px; color: #111827;">
        <h1 style="margin: 0 0 16px;">Nova Mensagem do Site</h1>
        <p><strong>Assunto:</strong> {safe_subject}</p>
        <p><strong>Nome:</strong> {safe_name}</p>
        <p><strong>Email:</strong> {safe_email}</p>
        <hr>
        <p><strong>Mensagem:</strong></p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; line-height: 1.5;">
        {message_html}
        </div>
        </div>
        """

        message = MessageSchema(
            subject=safe_subject,
            recipients=["general@watt-builder.com"],  # O TEU EMAIL AQUI
            body=email_body,
            subtype=MessageType.html,
            reply_to=[str(contact.email)]  # ✅ Reply-To com o email do utilizador
        )

        fm = FastMail(conf)
        await fm.send_message(message)

        return {"message": "Email enviado com sucesso"}

    except Exception as e:
        print(f"Erro ao enviar email: {e}")
        raise HTTPException(status_code=500, detail="Falha ao enviar email")


# --- ROTAS DE AUTH ---
@app.post("/auth/signup", response_model=UserResponse)
async def signup(user: UserCreate):
    # Removemos o check simples 'if db_users.user_exists'

    hashed_pwd = security.get_password_hash(user.password)

    try:
        # Usa o novo método que lida com utilizadores não verificados
        new_user = db_users.create_or_update_unverified_user(
            email=user.email,
            full_name=user.full_name,
            company=user.company,
            hashed_password=hashed_pwd,
            credits=5
        )

        frontend_url = os.getenv(
            "FRONTEND_URL", "https://www.watt-builder.com")
        token = new_user['verification_token']
        verify_link = f"{frontend_url}/verify-email?token={token}&email={user.email}"

        # Plain text version (importante para spam filters)
        email_text = f"""
Welcome to WattBuilder!

Hi {user.full_name},

Welcome to WattBuilder! We're excited to have you on board.
Please confirm your email address to activate your account and start building.

Click the link below to verify your email:
{verify_link}

This link is valid for 24 hours.

If you didn't create an account with WattBuilder, you can safely ignore this email.
Your account will not be activated.

For security reasons, never share this link with anyone.

Best regards,
The WattBuilder Team
        """

        email_body = f"""
                <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                    <h2 style="color: #111827;">Verify your email address</h2>

                    <p>Hi {user.full_name},</p>

                    <p>
                        Welcome to WattBuilder! We're excited to have you on board.
                        Please confirm your email address to activate your account and start building.
                    </p>

                    <p style="text-align: center; margin: 32px 0;">
                        <a href="{verify_link}"
                        style="
                                background-color: #f97316;
                                color: #ffffff;
                                padding: 12px 24px;
                                text-decoration: none;
                                font-weight: bold;
                                border-radius: 6px;
                                display: inline-block;
                        ">
                            Verify Email
                        </a>
                    </p>

                    <p>
                        This link is valid for <strong>24 hours</strong>.
                    </p>

                    <p style="font-size: 14px; color: #6b7280;">
                        If you didn't create an account with WattBuilder, you can safely ignore this email.
                        Your account will not be activated.
                    </p>

                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

                    <p style="font-size: 12px; color: #9ca3af;">
                        For security reasons, never share this link with anyone.
                    </p>
                </div>
                """

        message = MessageSchema(
            subject="Verify your WattBuilder Account",
            recipients=[user.email],
            body=email_body,
            subtype=MessageType.html,
            reply_to=[mail_from]  # ✅ CRÍTICO: Reply-To header
        )

        fm = FastMail(conf)
        await fm.send_message(message)

        return new_user

    except ValueError as e:
        # Se cair aqui, é porque o utilizador já está verificado
        raise HTTPException(status_code=400, detail=str(e))

# 3. NOVO ENDPOINT para o link do e-mail:


@app.post("/auth/verify-email")
def verify_email(data: dict):  # recebe {'email': '...', 'token': '...'}
    if db_users.verify_user(data['email'], data['token']):
        return {"message": "Email verified successfully"}
    raise HTTPException(status_code=400, detail="Invalid or expired token")


@app.post("/auth/login", response_model=Token)
def login(creds: UserLogin):
    user = db_users.get_user_by_email(creds.email)

    if not user or not security.verify_password(creds.password, user['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.get('is_verified', False):
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please check your inbox and click the verification link. If you didn't receive it, use the resend option.",
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
        "email": user['email'],
        "credits": user['credits'],
        "trial_started_at": user.get('trial_started_at'),
        "admin": user.get('admin', False)
    }


@app.post("/auth/google-login", response_model=Token)
def google_login(creds: GoogleLogin):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not google_client_id:
        raise HTTPException(
            status_code=500, detail="Google login is not configured")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        idinfo = google_id_token.verify_oauth2_token(
            creds.credential,
            google_requests.Request(),
            google_client_id,
        )
    except ImportError:
        raise HTTPException(
            status_code=500, detail="Google auth dependency is not installed")
    except ValueError:
        raise HTTPException(
            status_code=401, detail="Invalid Google credential")

    if not idinfo.get("email_verified"):
        raise HTTPException(
            status_code=403, detail="Google email is not verified")

    email = idinfo.get("email")
    if not email:
        raise HTTPException(
            status_code=401, detail="Google account has no email")

    full_name = idinfo.get("name") or email
    try:
        user = db_users.create_or_update_google_user(
            email=email, full_name=full_name, credits=5)
    except NoCredentialsError:
        raise HTTPException(
            status_code=500,
            detail="AWS credentials are not configured for DynamoDB access",
        )
    except ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"DynamoDB error: {e.response.get('Error', {}).get('Code', 'unknown')}",
        )

    access_token = security.create_access_token(data={"sub": user["email"]})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_name": user["full_name"],
        "email": user["email"],
        "credits": user.get("credits", 0),
        "trial_started_at": user.get("trial_started_at"),
        "admin": user.get("admin", False)
    }


@app.post("/auth/deduct-credit")
def deduct_credit(current_user: dict = Depends(get_current_user)):
    return {"remaining_credits": None, "credits_unlimited": True}


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


@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.post("/auth/forgot-password")
async def forgot_password(request: PasswordResetRequest):
    # 1. Gerar Token
    token = str(uuid.uuid4())

    # 2. Guardar na DB (Se o user existir)
    # Nota: Por segurança, respondemos sempre "200 OK" mesmo que o email não exista
    if db_users.save_reset_token(request.email, token):
        # 3. Enviar Email
        # O link aponta para o teu frontend
        frontend_url = os.getenv(
            "FRONTEND_URL", "https://www.watt-builder.com")
        reset_link = f"{frontend_url}/reset-password?token={token}&email={request.email}"

        email_body = f"""
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <h2 style="color: #111827;">Reset your password</h2>

            <p>Hello,</p>

            <p>
                We received a request to reset the password for your account.
                Click the button below to choose a new password.
            </p>

            <p style="text-align: center; margin: 32px 0;">
                <a href="{reset_link}"
                style="
                        background-color: #f97316;
                        color: #ffffff;
                        padding: 12px 24px;
                        text-decoration: none;
                        font-weight: bold;
                        border-radius: 6px;
                        display: inline-block;
                ">
                    Reset Password
                </a>
            </p>

            <p>
                This link is valid for <strong>1 hour</strong>.
            </p>

            <p style="font-size: 14px; color: #6b7280;">
                If you didn’t request a password reset, you can safely ignore this email.
                Your password will not be changed.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

            <p style="font-size: 12px; color: #9ca3af;">
                For security reasons, never share this link with anyone.
            </p>
        </div>
        """

        message = MessageSchema(
            subject="WattBuilder Password Reset",
            recipients=[request.email],
            body=email_body,
            subtype=MessageType.html,
            reply_to=[mail_from]  # ✅ CRÍTICO: Reply-To header
        )

        try:
            fm = FastMail(conf)
            await fm.send_message(message)
        except Exception as e:
            print(f"Error sending email: {e}")
            # Em produção, deves logar o erro mas não falhar o request para não revelar info

    return {"message": "If an account exists, an email has been sent."}


@app.post("/auth/reset-password")
def reset_password_confirm(data: PasswordResetConfirm):
    try:
        new_hash = security.get_password_hash(data.new_password)
        db_users.reset_password(data.email, data.token, new_hash)
        return {"message": "Password updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 🔄 Resend Verification Email
@app.post("/auth/resend-verification-email")
async def resend_verification_email(data: dict):  # recebe {'email': '...'}
    email = data.get('email')
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = db_users.get_user_by_email(email)

    # Por segurança, respondemos sempre "OK" mesmo que o email não exista
    if user and not user.get('is_verified', False):
        try:
            # Sempre gerar um NOVO token (não usar o antigo)
            token = str(uuid.uuid4())

            # Guardar o novo token na DB
            db_users.update_verification_token(email, token)

            frontend_url = os.getenv(
                "FRONTEND_URL", "https://www.watt-builder.com")
            verify_link = f"{frontend_url}/verify-email?token={token}&email={email}"

            email_body = f"""
                <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                    <h2 style="color: #111827;">Verify your email address</h2>

                    <p>Hi {user['full_name']},</p>

                    <p>
                        Welcome to WattBuilder! We're excited to have you on board.
                        Please confirm your email address to activate your account and start building.
                    </p>

                    <p style="text-align: center; margin: 32px 0;">
                        <a href="{verify_link}"
                        style="
                                background-color: #f97316;
                                color: #ffffff;
                                padding: 12px 24px;
                                text-decoration: none;
                                font-weight: bold;
                                border-radius: 6px;
                                display: inline-block;
                        ">
                            Verify Email
                        </a>
                    </p>

                    <p>
                        This link is valid for <strong>24 hours</strong>.
                    </p>

                    <p style="font-size: 14px; color: #6b7280;">
                        If you didn't create an account with WattBuilder, you can safely ignore this email.
                        Your account will not be activated.
                    </p>

                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

                    <p style="font-size: 12px; color: #9ca3af;">
                        For security reasons, never share this link with anyone.
                    </p>
                </div>
                """

            message = MessageSchema(
                subject="Verify your WattBuilder Account",
                recipients=[email],
                body=email_body,
                subtype=MessageType.html,
                reply_to=[mail_from]
            )

            fm = FastMail(conf)
            await fm.send_message(message)

        except Exception as e:
            # Silentiosamente falha sem revelar informações
            pass

    # Respondemos sempre sucesso por segurança
    return {"message": "If an account exists and is not verified, a verification email has been sent."}


def load_catalog():
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    db_path = os.path.join(data_dir, "home_energy_catalog.sqlite")
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        catalog = {
            "schema_version": "1.0.0",
            "currency": "EUR",
            "batteries": [sqlite_battery_to_catalog_item(row) for row in conn.execute("SELECT * FROM home_batteries WHERE is_active = 1 ORDER BY id")],
            "inverters": [sqlite_inverter_to_catalog_item(row) for row in conn.execute("SELECT * FROM home_inverters WHERE is_active = 1 ORDER BY id")],
            "solar_panels": [sqlite_panel_to_catalog_item(row) for row in conn.execute("SELECT * FROM home_solar_panels WHERE is_active = 1 ORDER BY id")],
        }
    return catalog


def validate_sqlite_home_catalog():
    catalog = load_catalog()
    missing = []
    for key in ("batteries", "inverters", "solar_panels"):
        if not catalog[key]:
            missing.append(key)
    if missing:
        raise RuntimeError(
            f"SQLite home catalog validation failed. Empty tables: {', '.join(missing)}")
    print(
        "Home SQLite catalog OK "
        f"({len(catalog['batteries'])} batteries, "
        f"{len(catalog['inverters'])} inverters, "
        f"{len(catalog['solar_panels'])} panels)"
    )


def sqlite_battery_to_catalog_item(row):
    return {
        "id": row["id"],
        "brand": row["brand_name"],
        "model": row["model_name"],
        "specs": {
            "capacity_kwh": row["capacity_kwh"],
            "usable_capacity_kwh": row["usable_capacity_kwh"],
            "power_kw": row["continuous_power_kw"],
            "dod": row["depth_of_discharge_ratio"],
            "chemistry": row["chemistry"],
            "battery_type": row["battery_type"],
            "nominal_voltage_class": row["nominal_voltage_class"],
            "size_mm": {
                "thickness": row["depth_mm"],
                "width": row["width_mm"],
                "height": row["height_mm"],
            },
            "dimensions_mm": {
                "width": row["width_mm"],
                "height": row["height_mm"],
                "depth": row["depth_mm"],
            },
            "weight_kg": row["weight_kg"],
            "operating_temperature_c": {
                "min": row["operating_temp_min_c"],
                "max": row["operating_temp_max_c"],
            },
            "environment": row["environment"],
            "max_series_connection": row["max_series_connection"],
            "max_parallel_connection": row["max_parallel_connection"],
            "warranty_years": row["warranty_years"],
            "compatible_inverter_ids": parse_json_list(
                row["compatible_inverter_ids_json"]),
        },
        "pricing": {
            "unit_price": row["unit_price"],
            "currency": row["currency"] or "EUR",
        },
        "links": {
            "url": row["source_url"] or "",
        },
    }


def sqlite_inverter_to_catalog_item(row):
    return {
        "id": row["id"],
        "brand": row["brand_name"],
        "model": row["model_name"],
        "specs": {
            "power_kw": row["power_kw"] or row["rated_output_power_kw"] or row["max_battery_charge_discharge_kw"],
            "rated_output_power_kw": row["rated_output_power_kw"],
            "max_pv_input_kwp": row["max_pv_input_kwp"],
            "pv_voltage_range_v": {
                "min": row["pv_voltage_min_v"],
                "max": row["pv_voltage_max_v"],
            },
            "max_battery_charge_discharge_kw": row["max_battery_charge_discharge_kw"],
            "battery_technology": row["battery_technology"],
            "battery_type": row["nominal_battery_voltage_class"] or row["battery_technology"],
            "battery_voltage_range_v": {
                "min": row["battery_voltage_min_v"],
                "max": row["battery_voltage_max_v"],
            },
            "grid_type": row["grid_type"],
            "phases": row["phases"],
            "is_hybrid": bool(row["is_hybrid"]),
            "connection": row["connection_type"],
            "max_efficiency": row["max_efficiency_ratio"],
            "warranty_years": row["warranty_years"],
            "weight_kg": row["weight_kg"],
            "dimensions_mm": {
                "width": row["width_mm"],
                "height": row["height_mm"],
                "depth": row["depth_mm"],
            },
            "operating_temperature_c": {
                "min": row["operating_temp_min_c"],
                "max": row["operating_temp_max_c"],
            },
            "environment": row["environment"],
            "has_direct_pv_input": bool(row["has_direct_pv_input"]),
        },
        "pricing": {
            "unit_price": row["unit_price"],
            "currency": row["currency"] or "EUR",
        },
        "links": {
            "url": row["source_url"] or "",
        },
    }


def sqlite_panel_to_catalog_item(row):
    return {
        "id": row["id"],
        "brand": row["brand_name"],
        "model": row["model_name"],
        "specs": {
            "power_w": row["rated_power_w"],
            "rated_power_kw": row["rated_power_kw"],
            "efficiency_pct": row["efficiency_pct"],
            "technology": row["technology"],
            "type": row["cell_type"],
            "dimensions_mm": {
                "length": row["length_mm"],
                "width": row["width_mm"],
                "height": row["height_mm"],
            },
            "weight_kg": row["weight_kg"],
        },
        "pricing": {
            "unit_price": row["unit_price"],
            "currency": row["currency"] or "EUR",
        },
        "links": {
            "url": row["source_url"] or "",
        },
    }


def parse_json_list(value):
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


@app.post("/api/simulator/size")
async def size_battery(req: SimulatorRequest, current_user: dict = Depends(get_current_user)):
    catalog = load_catalog()
    result = optimize_home_battery(
        mode=req.mode,
        input_data=req.input,
        tariff=req.tariff,
        solar=req.solar or {},
        assumptions=req.assumptions,
        catalog=catalog,
        max_investment=req.max_investment,
    )
    try:
        db_users.save_simulation_input(
            current_user,
            req.model_dump(mode="json"),
        )
    except Exception as e:
        print(f"❌ Erro ao guardar input da simulação: {e}")

    return result

handler = Mangum(app)

if __name__ == "__main__":
    # Corre o servidor na porta definida no .env (default 8000)
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
