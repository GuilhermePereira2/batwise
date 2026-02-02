#!/bin/bash
# Script para criar tabela DynamoDB Local

cd "$(dirname "$0")/../.."

echo "🔧 Setup DynamoDB Local"

# Carregar .env
if [ -f backend/.env ]; then
    source backend/.env
    echo "✅ Config carregada"
else
    echo "⚠️  Usando defaults"
    export DYNAMODB_ENDPOINT="http://localhost:8000"
    export AWS_REGION="local"
    export USERS_TABLE_NAME="batwise-users"
fi

# Verificar se DynamoDB Local está a correr
echo ""
echo "🔍 Verificando DynamoDB Local..."
if ! curl -s $DYNAMODB_ENDPOINT > /dev/null 2>&1; then
    echo "❌ DynamoDB Local não está a correr em $DYNAMODB_ENDPOINT"
    echo ""
    echo "Para iniciar (nesta pasta):"
    echo "  java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -port 8000"
    exit 1
fi
echo "✅ DynamoDB Local ativo"

# Criar tabela
echo ""
echo "📊 Criando tabela '$USERS_TABLE_NAME'..."

python3 - <<EOF
import boto3
import os

dynamodb = boto3.client(
    'dynamodb',
    endpoint_url=os.getenv('DYNAMODB_ENDPOINT'),
    region_name=os.getenv('AWS_REGION', 'local'),
    aws_access_key_id='dummy',
    aws_secret_access_key='dummy'
)

table_name = os.getenv('USERS_TABLE_NAME', 'batwise-users')

try:
    # Verificar se já existe
    dynamodb.describe_table(TableName=table_name)
    print(f"⚠️  Tabela '{table_name}' já existe!")
except:
    # Criar nova tabela
    dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {'AttributeName': 'userId', 'KeyType': 'HASH'}
        ],
        AttributeDefinitions=[
            {'AttributeName': 'userId', 'AttributeType': 'S'}
        ],
        BillingMode='PAY_PER_REQUEST'
    )
    print(f"✅ Tabela '{table_name}' criada com sucesso!")
EOF

echo ""
echo "🎉 Setup completo!"
echo ""
echo "Para testar:"
echo "  cd database/test"
echo "  python3 view_database.py"
