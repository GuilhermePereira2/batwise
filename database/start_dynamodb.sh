#!/bin/bash
# Script para iniciar DynamoDB Local

echo "🚀 Verificando DynamoDB Local..."

# Verificar se já está a correr
if curl -s http://localhost:8000 > /dev/null 2>&1; then
    echo "✅ DynamoDB Local já está a correr em http://localhost:8000"
    exit 0
fi

echo "📦 Iniciando DynamoDB Local..."

# Parar containers antigos (se existirem parados)
docker ps -a | grep dynamodb-local | grep -v "Up" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null

# Iniciar sem persistência
docker run -d \
  --name dynamodb-local \
  -p 8000:8000 \
  amazon/dynamodb-local

echo ""
echo "✅ DynamoDB Local iniciado em http://localhost:8000"
