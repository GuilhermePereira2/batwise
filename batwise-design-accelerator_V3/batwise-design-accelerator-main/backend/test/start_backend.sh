#!/bin/bash
# Script para iniciar o backend localmente

cd "$(dirname "$0")/.."

echo "🚀 Iniciando BatWise Backend..."

# Carregar .env
if [ -f .env ]; then
    source .env
    echo "✅ Variáveis carregadas de .env"
else
    echo "⚠️  Ficheiro .env não encontrado, usando defaults"
fi

# Verificar se quer usar DynamoDB Local ou AWS
if [ -n "$DYNAMODB_ENDPOINT" ]; then
    echo "🔧 Modo: DynamoDB Local ($DYNAMODB_ENDPOINT)"
    
    # Verificar se está a correr
    if ! curl -s $DYNAMODB_ENDPOINT > /dev/null 2>&1; then
        echo "❌ DynamoDB Local não está a correr!"
        echo "   Inicia em outro terminal: java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -port 8000"
        exit 1
    fi
else
    echo "☁️  Modo: AWS DynamoDB (região: ${AWS_REGION:-eu-west-3})"
fi

# Iniciar servidor
echo ""
echo "📡 Servidor iniciando em http://0.0.0.0:8001"
echo "📚 Docs em http://localhost:8001/docs"
echo ""

python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
