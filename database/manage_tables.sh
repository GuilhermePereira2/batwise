#!/bin/bash
# Script para gerenciar tabelas DynamoDB Local

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

# Carregar .env da raiz
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | grep -v '^$' | xargs)
else
    export DYNAMODB_ENDPOINT="http://localhost:8000"
    export AWS_REGION="local"
fi

echo "📊 Gestor de Tabelas DynamoDB Local"
echo "Endpoint: $DYNAMODB_ENDPOINT"
echo ""
echo "Opções:"
echo "  1) Listar tabelas"
echo "  2) Apagar tabela"
echo "  3) Ver detalhes de uma tabela"
echo ""

read -p "Escolhe uma opção (1-3): " CHOICE

case $CHOICE in
  1)
    echo ""
    echo "📋 Listando tabelas..."
    python3 - <<EOF
import boto3

dynamodb = boto3.client(
    'dynamodb',
    endpoint_url='$DYNAMODB_ENDPOINT',
    region_name='$AWS_REGION',
    aws_access_key_id='dummy',
    aws_secret_access_key='dummy'
)

try:
    response = dynamodb.list_tables()
    tables = response.get('TableNames', [])
    
    if tables:
        print(f"✅ Encontradas {len(tables)} tabela(s):\n")
        for i, table in enumerate(tables, 1):
            print(f"  {i}. {table}")
    else:
        print("❌ Nenhuma tabela encontrada")
except Exception as e:
    print(f"❌ Erro: {e}")
EOF
    ;;
    
  2)
    echo ""
    read -p "Nome da tabela a apagar: " TABLE_NAME
    
    read -p "Tens a certeza? (sim/nao): " CONFIRM
    
    if [ "$CONFIRM" = "sim" ]; then
        python3 - <<EOF
import boto3

dynamodb = boto3.client(
    'dynamodb',
    endpoint_url='$DYNAMODB_ENDPOINT',
    region_name='$AWS_REGION',
    aws_access_key_id='dummy',
    aws_secret_access_key='dummy'
)

try:
    dynamodb.delete_table(TableName="$TABLE_NAME")
    print(f"✅ Tabela '{table['TableName']}' apagada com sucesso!")
except Exception as e:
    print(f"❌ Erro: {e}")
EOF
    else
        echo "❌ Cancelado"
    fi
    ;;
    
  3)
    echo ""
    read -p "Nome da tabela: " TABLE_NAME
    
    python3 - <<EOF
import boto3
import json

dynamodb = boto3.client(
    'dynamodb',
    endpoint_url='$DYNAMODB_ENDPOINT',
    region_name='$AWS_REGION',
    aws_access_key_id='dummy',
    aws_secret_access_key='dummy'
)

try:
    response = dynamodb.describe_table(TableName="$TABLE_NAME")
    table = response['Table']
    
    print(f"\n📊 Detalhes da tabela '{table['TableName']}':\n")
    print(f"  Status: {table['TableStatus']}")
    print(f"  Itens: {table['ItemCount']}")
    print(f"  Tamanho: {table['TableSizeBytes']} bytes")
    print(f"  Chave primária: {table['KeySchema']}")
    print(f"  Atributos: {table['AttributeDefinitions']}")
    
except Exception as e:
    print(f"❌ Erro: {e}")
EOF
    ;;
    
  *)
    echo "❌ Opção inválida"
    exit 1
    ;;
esac
