"""
DynamoDB Handler para gestão de utilizadores
Suporta tanto AWS DynamoDB como DynamoDB Local
"""
import os
import boto3
import json
import botocore.session
from botocore.exceptions import ClientError
from decimal import Decimal
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from dotenv import load_dotenv
from pathlib import Path
import uuid


def load_database_env() -> None:
    """
    Carrega variáveis de ambiente do .env na raiz.
    Ignora AWS_PROFILE/AWS_DEFAULT_PROFILE definidos na .env para o boto3 usar
    a conta default configurada no computador, a menos que o perfil já venha
    exportado no ambiente da shell.
    """
    backend_dir = Path(__file__).resolve().parent
    root_dir = backend_dir.parent

    # Procura na raiz do projeto
    root_env = root_dir / ".env"
    if root_env.exists():
        before_profile = os.environ.get("AWS_PROFILE")
        before_default_profile = os.environ.get("AWS_DEFAULT_PROFILE")
        load_dotenv(dotenv_path=root_env, override=True)
        if before_profile is None:
            os.environ.pop("AWS_PROFILE", None)
        else:
            os.environ["AWS_PROFILE"] = before_profile

        if before_default_profile is None:
            os.environ.pop("AWS_DEFAULT_PROFILE", None)
        else:
            os.environ["AWS_DEFAULT_PROFILE"] = before_default_profile
        return


# Carregar variáveis de ambiente do ficheiro na raiz
load_database_env()


# Configuração - usar variáveis de ambiente
DYNAMODB_ENDPOINT = os.getenv("DYNAMODB_ENDPOINT") or None  # None = AWS real
AWS_REGION = os.getenv("AWS_REGION", "eu-west-3")
USERS_TABLE_NAME = os.getenv("USERS_TABLE_NAME", "watt-builder-Users")
SIMULATION_INPUTS_TABLE_NAME = os.getenv("SIMULATION_INPUTS_TABLE_NAME", "watt-builder-SimulationInputs")

# Debug: Ver se as variáveis foram carregadas
print(f"🔍 Debug - AWS_REGION: {AWS_REGION}")
print(f"🔍 Debug - USERS_TABLE_NAME: {USERS_TABLE_NAME}")
print(f"🔍 Debug - SIMULATION_INPUTS_TABLE_NAME: {SIMULATION_INPUTS_TABLE_NAME}")
print(f"🔍 Debug - DYNAMODB_ENDPOINT: {DYNAMODB_ENDPOINT}")

# Forçar a variável de ambiente para o boto3
os.environ['AWS_REGION'] = AWS_REGION
os.environ['AWS_DEFAULT_REGION'] = AWS_REGION


def _clear_invalid_aws_profile() -> None:
    """
    Remove AWS_PROFILE quando o profile configurado não existe localmente.

    Evita que o import falhe em máquinas onde a .env aponta para um profile
    que ainda não foi criado no ~/.aws/config.
    """
    configured_profile = os.getenv("AWS_PROFILE") or os.getenv("AWS_DEFAULT_PROFILE")
    if not configured_profile:
        return

    available_profiles = set(botocore.session.Session().available_profiles)
    if configured_profile in available_profiles:
        return

    print(
        f"⚠️  AWS profile '{configured_profile}' not found. Falling back to default credential chain."
    )
    os.environ.pop("AWS_PROFILE", None)
    os.environ.pop("AWS_DEFAULT_PROFILE", None)


_clear_invalid_aws_profile()

# Cliente DynamoDB
if DYNAMODB_ENDPOINT:
    # DynamoDB Local (desenvolvimento)
    dynamodb = boto3.resource(
        'dynamodb',
        endpoint_url=DYNAMODB_ENDPOINT,
        region_name=AWS_REGION,
        aws_access_key_id='dummy',  # DynamoDB local não precisa de credenciais reais
        aws_secret_access_key='dummy'
    )
    print(f"🔧 DynamoDB Local conectado: {DYNAMODB_ENDPOINT}")
else:
    # AWS DynamoDB (produção)
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    print(f"☁️  AWS DynamoDB conectado: {AWS_REGION}")

users_table = dynamodb.Table(USERS_TABLE_NAME)
simulation_inputs_table = dynamodb.Table(SIMULATION_INPUTS_TABLE_NAME)


def _is_admin_user(user: Dict) -> bool:
    admin_value = user.get("admin")
    if isinstance(admin_value, bool):
        return admin_value
    if admin_value is None:
        return False
    if isinstance(admin_value, (int, Decimal)):
        return admin_value == 1
    if isinstance(admin_value, str):
        return admin_value.strip().lower() in {"true", "1", "yes", "sim"}
    return bool(admin_value)


def _timezone_from_name(timezone_name: Optional[str]):
    if not timezone_name:
        return ZoneInfo("UTC"), "UTC"
    try:
        return ZoneInfo(timezone_name), timezone_name
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC"), "UTC"


def _to_dynamodb_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    return json.loads(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        parse_float=Decimal,
    )


class DynamoDBUserHandler:
    """Handler para operações de utilizadores no DynamoDB"""

    @staticmethod
    def save_simulation_input(user: Dict, payload: Dict) -> Optional[Dict]:
        """
        Guarda o input completo da simulação para clientes não-admin.
        Admins são ignorados para não contaminar a base de dados de leads/clientes.
        """
        if _is_admin_user(user):
            return None

        storage_payload = dict(payload)
        client_timezone = storage_payload.pop("client_timezone", None)
        storage_payload.pop("client_submitted_at", None)

        now_utc = datetime.now(timezone.utc)
        tzinfo, _ = _timezone_from_name(client_timezone)
        local_now = now_utc.astimezone(tzinfo)
        created_at = local_now.isoformat(timespec="seconds")
        item = {
            "simulationId": str(uuid.uuid4()),
            "userId": user.get("userId"),
            "email": user.get("email"),
            "full_name": user.get("full_name"),
            "created_at": created_at,
            "mode": storage_payload.get("mode"),
            "input": _to_dynamodb_payload(storage_payload.get("input") or {}),
            "tariff": _to_dynamodb_payload(storage_payload.get("tariff") or {}),
            "solar": _to_dynamodb_payload(storage_payload.get("solar") or {}),
            "assumptions": _to_dynamodb_payload(storage_payload.get("assumptions") or {}),
            "max_investment": Decimal(str(storage_payload["max_investment"])) if storage_payload.get("max_investment") is not None else None,
            "form_data": _to_dynamodb_payload(storage_payload.get("form_data") or {}),
            "payload_json": json.dumps(storage_payload, ensure_ascii=False, separators=(",", ":")),
        }

        simulation_inputs_table.put_item(Item=item)
        return item

    @staticmethod
    def create_or_update_unverified_user(email: str, full_name: str, hashed_password: str, company: Optional[str] = None, credits: int = 5) -> Dict:
        # 1. Verificar se o utilizador já existe
        existing_user = DynamoDBUserHandler.get_user_by_email(email)

        # 2. Se já existe e está verificado, lançamos erro
        if existing_user and existing_user.get('is_verified'):
            raise ValueError(f"This email already exists and is verified. Please log in or use a different email address.")

        # 3. Se não existe, criamos um novo ID. Se existe (não verificado), mantemos o mesmo userId
        user_id = existing_user['userId'] if existing_user else str(
            uuid.uuid4())
        token = str(uuid.uuid4())

        item = {
            'userId': user_id,
            'email': email,
            'full_name': full_name,
            'hashed_password': hashed_password,
            'credits': credits,
            'is_verified': False,
            'verification_token': token,
            'created_at': existing_user['created_at'] if existing_user else datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
            'company': company,
            'admin': False
        }

        users_table.put_item(Item=item)
        return item

    @staticmethod
    def create_or_update_google_user(email: str, full_name: str, credits: int = 5) -> Dict:
        try:
            existing_user = DynamoDBUserHandler.get_user_by_email(email)
        except ClientError:
            raise
        except Exception as e:
            print(f"❌ Erro ao aceder ao DynamoDB no login Google: {e}")
            raise
        now = datetime.utcnow().isoformat()

        if existing_user:
            update_expression = "SET full_name = :full_name, is_verified = :verified, updated_at = :now, auth_provider = :provider REMOVE verification_token"
            users_table.update_item(
                Key={'userId': existing_user['userId']},
                UpdateExpression=update_expression,
                ExpressionAttributeValues={
                    ':full_name': full_name or existing_user.get('full_name') or email,
                    ':verified': True,
                    ':now': now,
                    ':provider': 'google',
                }
            )
            updated = dict(existing_user)
            updated.update({
                'full_name': full_name or existing_user.get('full_name') or email,
                'is_verified': True,
                'updated_at': now,
                'auth_provider': 'google',
            })
            updated.pop('verification_token', None)
            return updated

        item = {
            'userId': str(uuid.uuid4()),
            'email': email,
            'full_name': full_name or email,
            'credits': credits,
            'is_verified': True,
            'created_at': now,
            'updated_at': now,
            'company': None,
            'admin': False,
            'auth_provider': 'google',
        }

        users_table.put_item(Item=item)
        return item

    @staticmethod
    def get_user_by_email(email: str) -> Optional[Dict]:
        """
        Busca um utilizador pelo email usando Query no GSI

        Args:
            email: Email do utilizador

        Returns:
            Dict com dados do utilizador ou None se não encontrado
        """
        try:
            # Usar Query no GSI email-index (muito mais rápido que Scan)
            response = users_table.query(
                IndexName='email-index',
                KeyConditionExpression='email = :email',
                ExpressionAttributeValues={':email': email}
            )
            items = response.get('Items', [])
            return items[0] if items else None
        except ClientError as e:
            print(f"❌ Erro ao buscar utilizador: {e}")
            return None

    @staticmethod
    def update_credits(email: str, credits_delta: int) -> int:
        """
        Atualiza os créditos de um utilizador

        Args:
            email: Email do utilizador
            credits_delta: Quantidade a adicionar/remover (pode ser negativo)

        Returns:
            Novo valor de créditos

        Raises:
            ValueError: Se o utilizador não existir ou créditos ficarem negativos
        """
        try:
            # Primeiro, buscar o utilizador
            user = DynamoDBUserHandler.get_user_by_email(email)
            if not user:
                raise ValueError("Utilizador não encontrado")

            new_credits = user['credits'] + credits_delta

            # Validar se os créditos ficariam negativos
            if new_credits < 0:
                raise ValueError("Créditos insuficientes")

            # Atualizar com a nova quantidade usando userId como key
            response = users_table.update_item(
                Key={'userId': user['userId']},
                UpdateExpression='SET credits = :new_credits, updated_at = :now',
                ExpressionAttributeValues={
                    ':new_credits': new_credits,
                    ':now': datetime.utcnow().isoformat(),
                },
                ConditionExpression='attribute_exists(userId)',
                ReturnValues='UPDATED_NEW'
            )

            updated_credits = response['Attributes']['credits']
            print(f"💰 Créditos atualizados para {email}: {updated_credits}")
            return updated_credits

        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                raise ValueError("Utilizador não encontrado")
            raise

    @staticmethod
    def deduct_credit(email: str) -> int:
        """
        Deduz 1 crédito do utilizador

        Args:
            email: Email do utilizador

        Returns:
            Créditos restantes
        """
        return DynamoDBUserHandler.update_credits(email, -1)

    @staticmethod
    def add_credits(email: str, amount: int) -> int:
        """
        Adiciona créditos ao utilizador

        Args:
            email: Email do utilizador
            amount: Quantidade de créditos a adicionar

        Returns:
            Novo total de créditos
        """
        return DynamoDBUserHandler.update_credits(email, amount)

    @staticmethod
    def user_exists(email: str) -> bool:
        """
        Verifica se um utilizador existe

        Args:
            email: Email a verificar

        Returns:
            True se existir, False caso contrário
        """
        return DynamoDBUserHandler.get_user_by_email(email) is not None

    @staticmethod
    def verify_user(email: str, token: str):
        user = DynamoDBUserHandler.get_user_by_email(email)
        if user and user.get('verification_token') == token:
            users_table.update_item(
                Key={'userId': user['userId']},
                UpdateExpression="SET is_verified = :v REMOVE verification_token",
                ExpressionAttributeValues={':v': True}
            )
            return True
        return False

    @staticmethod
    def update_verification_token(email: str, token: str) -> bool:
        """
        Atualiza o token de verificação de um utilizador

        Args:
            email: Email do utilizador
            token: Novo token de verificação

        Returns:
            True se atualizado com sucesso, False caso contrário
        """
        try:
            user = DynamoDBUserHandler.get_user_by_email(email)
            if user:
                users_table.update_item(
                    Key={'userId': user['userId']},
                    UpdateExpression="SET verification_token = :token",
                    ExpressionAttributeValues={':token': token}
                )
                return True
            return False
        except ClientError as e:
            print(f"❌ Erro ao atualizar token: {e}")
            return False

    @staticmethod
    def delete_user(email: str) -> bool:
        """
        Remove um utilizador (CUIDADO!)

        Args:
            email: Email do utilizador a remover

        Returns:
            True se removido com sucesso
        """
        try:
            # Primeiro buscar o userId
            user = DynamoDBUserHandler.get_user_by_email(email)
            if not user:
                print(f"⚠️  Utilizador não encontrado: {email}")
                return False

            users_table.delete_item(
                Key={'userId': user['userId']},
                ConditionExpression='attribute_exists(userId)'
            )
            print(f"🗑️  Utilizador removido: {email}")
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                print(f"⚠️  Utilizador não encontrado: {email}")
                return False
            raise

    @staticmethod
    def activate_trial_for_user(email: str, start_date: str, bonus_credits: int) -> Dict:
        """
        Ativa o free trial: define a data de início e atribui os créditos.
        """
        # 1. Precisamos do userId (Primary Key) para fazer o update
        user = DynamoDBUserHandler.get_user_by_email(email)
        if not user:
            raise ValueError("Utilizador não encontrado")

        try:
            response = users_table.update_item(
                Key={'userId': user['userId']},
                # Define créditos, data de inicio do trial e data de update
                UpdateExpression="SET credits = :c, trial_started_at = :t, updated_at = :u",
                ExpressionAttributeValues={
                    ':c': bonus_credits,
                    ':t': start_date,
                    ':u': datetime.utcnow().isoformat()
                },
                ReturnValues="ALL_NEW"
            )
            print(f"🎉 Free Trial ativado para {email}")
            return response['Attributes']
        except ClientError as e:
            print(f"❌ Erro ao ativar trial: {e}")
            raise

    @staticmethod
    def update_user_credits(email: str, new_amount: int) -> None:
        """
        Força um valor específico de créditos (usado para zerar quando o trial expira).
        """
        user = DynamoDBUserHandler.get_user_by_email(email)
        if user:
            try:
                users_table.update_item(
                    Key={'userId': user['userId']},
                    UpdateExpression="SET credits = :c",
                    ExpressionAttributeValues={':c': new_amount}
                )
                print(f"📉 Créditos forçados a {new_amount} para {email}")
            except ClientError as e:
                print(f"❌ Erro ao atualizar créditos: {e}")

    @staticmethod
    def save_reset_token(email: str, token: str):
        """Guarda o token de reset e a validade (1 hora)"""
        user = DynamoDBUserHandler.get_user_by_email(email)
        if not user:
            return False

        try:
            # Expira em 1 hora
            expiry = (datetime.utcnow() + timedelta(hours=1)).isoformat()

            # ATENÇÃO: Mudado de self.table para users_table
            users_table.update_item(
                Key={'userId': user['userId']},
                UpdateExpression="set reset_token = :t, reset_token_expiry = :e",
                ExpressionAttributeValues={
                    ':t': token,
                    ':e': expiry
                }
            )
            return True
        except ClientError as e:
            print(f"Error saving reset token: {e}")
            return False

    @staticmethod
    def reset_password(email: str, token: str, new_hashed_password: str):
        """Verifica o token e atualiza a password"""
        user = DynamoDBUserHandler.get_user_by_email(email)
        if not user:
            raise ValueError("User not found")

        stored_token = user.get('reset_token')
        expiry = user.get('reset_token_expiry')

        if not stored_token or not expiry:
            raise ValueError("No reset request found")

        if stored_token != token:
            raise ValueError("Invalid token")

        if datetime.utcnow().isoformat() > expiry:
            raise ValueError("Token expired")

        try:
            # ATENÇÃO: Mudado de self.table para users_table
            users_table.update_item(
                Key={'userId': user['userId']},
                UpdateExpression="set hashed_password = :p remove reset_token, reset_token_expiry",
                ExpressionAttributeValues={
                    ':p': new_hashed_password
                }
            )
            return True
        except ClientError as e:
            print(f"Error during password reset: {e}")
            raise e


# Instância global para uso fácil
db_users = DynamoDBUserHandler()
