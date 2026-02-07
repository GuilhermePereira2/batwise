"""
DynamoDB Handler para gestão de utilizadores
Suporta tanto AWS DynamoDB como DynamoDB Local
"""
import os
import boto3
from botocore.exceptions import ClientError
from typing import Optional, Dict
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path
import uuid


def load_database_env() -> None:
    """
    Carrega variáveis de ambiente do .env na raiz.
    """
    backend_dir = Path(__file__).resolve().parent
    root_dir = backend_dir.parent

    # Procura na raiz do projeto
    root_env = root_dir / ".env"
    if root_env.exists():
        load_dotenv(dotenv_path=root_env)
        return


# Carregar variáveis de ambiente do ficheiro na raiz
load_database_env()


# Configuração - usar variáveis de ambiente
DYNAMODB_ENDPOINT = os.getenv("DYNAMODB_ENDPOINT", None)  # None = AWS real
AWS_REGION = os.getenv("AWS_REGION", "eu-west-3")
USERS_TABLE_NAME = os.getenv("USERS_TABLE_NAME", "watt-builder-Users")

# Debug: Ver se as variáveis foram carregadas
print(f"🔍 Debug - AWS_REGION: {AWS_REGION}")
print(f"🔍 Debug - USERS_TABLE_NAME: {USERS_TABLE_NAME}")
print(f"🔍 Debug - DYNAMODB_ENDPOINT: {DYNAMODB_ENDPOINT}")

# Forçar a variável de ambiente para o boto3
os.environ['AWS_REGION'] = AWS_REGION
os.environ['AWS_DEFAULT_REGION'] = AWS_REGION

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


class DynamoDBUserHandler:
    """Handler para operações de utilizadores no DynamoDB"""

    @staticmethod
    def create_user(email: str, full_name: str, hashed_password: str, company: Optional[str] = None, credits: int = 5) -> Dict:
        """
        Cria um novo utilizador no DynamoDB

        Args:
            email: Email do utilizador
            full_name: Nome completo
            hashed_password: Password já hasheada
            company: Nome da empresa (opcional)
            credits: Créditos iniciais (default: 5)

        Returns:
            Dict com os dados do utilizador criado

        Raises:
            ClientError: Se o email já existir
        """
        # Verificar se email já existe (scan)
        if DynamoDBUserHandler.user_exists(email):
            raise ValueError("Email já registado")

        try:
            item = {
                'userId': str(uuid.uuid4()),  # Partition key
                'email': email,
                'full_name': full_name,
                'hashed_password': hashed_password,
                'credits': credits,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }

            if company:
                item['company'] = company

            users_table.put_item(Item=item)

            print(f"✅ Utilizador criado: {email}")
            return item

        except ClientError as e:
            raise

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
