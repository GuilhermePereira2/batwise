#!/bin/bash
# Script para criar tabela DynamoDB Local

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

echo "🔧 Setup DynamoDB Local"
echo "$ROOT_DIR/.env"


# Carregar .env da raiz
if [ -f "$ROOT_DIR/.env" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%%#*}"
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        if [ -n "$line" ] && [[ "$line" == *=* ]]; then
            export "$line"
        fi
    done < "$ROOT_DIR/.env"
    echo "✅ Config carregada de .env"
else
    echo "⚠️  Usando defaults"
    export DYNAMODB_ENDPOINT="http://localhost:8000"
    export AWS_REGION="local"
    export USERS_TABLE_NAME="watt-builder-Users"
    export SIMULATION_INPUTS_TABLE_NAME="watt-builder-SimulationInputs"
fi

# Verificar se DynamoDB Local está a correr
echo ""
echo "🔍 Verificando DynamoDB Local..."
if ! curl -s $DYNAMODB_ENDPOINT > /dev/null 2>&1; then
    echo "❌ DynamoDB Local não está a correr em $DYNAMODB_ENDPOINT"
    echo ""
    echo "Para iniciar:"
    echo "  docker run -d -p 8000:8000 amazon/dynamodb-local"
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

table_name = os.getenv('USERS_TABLE_NAME')
simulation_inputs_table_name = os.getenv('SIMULATION_INPUTS_TABLE_NAME', 'watt-builder-SimulationInputs')

try:
    # Verificar se já existe
    table = dynamodb.describe_table(TableName=table_name)["Table"]
    print(f"⚠️  Tabela '{table_name}' já existe!")
    indexes = [index["IndexName"] for index in table.get("GlobalSecondaryIndexes", [])]
    if "email-index" not in indexes:
        print("🔧 A adicionar GSI 'email-index'...")
        dynamodb.update_table(
            TableName=table_name,
            AttributeDefinitions=[
                {'AttributeName': 'email', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexUpdates=[
                {
                    'Create': {
                        'IndexName': 'email-index',
                        'KeySchema': [
                            {'AttributeName': 'email', 'KeyType': 'HASH'}
                        ],
                        'Projection': {'ProjectionType': 'ALL'},
                        'BillingMode': 'PAY_PER_REQUEST'
                    }
                }
            ]
        )
        print("✅ GSI 'email-index' criado!")
except:
    # Criar nova tabela
    dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {'AttributeName': 'userId', 'KeyType': 'HASH'}
        ],
        AttributeDefinitions=[
            {'AttributeName': 'userId', 'AttributeType': 'S'},
            {'AttributeName': 'email', 'AttributeType': 'S'}
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'email-index',
                'KeySchema': [
                    {'AttributeName': 'email', 'KeyType': 'HASH'}
                ],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ],
        BillingMode='PAY_PER_REQUEST'
    )
    print(f"✅ Tabela '{table_name}' criada com sucesso!")

try:
    dynamodb.describe_table(TableName=simulation_inputs_table_name)
    print(f"⚠️  Tabela '{simulation_inputs_table_name}' já existe!")
except:
    dynamodb.create_table(
        TableName=simulation_inputs_table_name,
        KeySchema=[
            {'AttributeName': 'simulationId', 'KeyType': 'HASH'}
        ],
        AttributeDefinitions=[
            {'AttributeName': 'simulationId', 'AttributeType': 'S'},
            {'AttributeName': 'email', 'AttributeType': 'S'}
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'email-index',
                'KeySchema': [
                    {'AttributeName': 'email', 'KeyType': 'HASH'}
                ],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ],
        BillingMode='PAY_PER_REQUEST'
    )
    print(f"✅ Tabela '{simulation_inputs_table_name}' criada com sucesso!")
EOF
