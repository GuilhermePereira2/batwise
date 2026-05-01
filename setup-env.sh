#!/bin/bash

# Script simples para configurar o ambiente

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$REPO_ROOT/.env"
ENV_EXAMPLE="$REPO_ROOT/.env.example"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        BatWise - Configuração de Ambiente                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Escolhe um cenário:"
echo ""
echo "1) Tudo Local (Frontend + Backend + Database Local)"
echo "2) Backend Local + Database Online (AWS)"
echo "3) Frontend Local + Backend/Database Online"
echo "4) Deploy em Produção (sem .env local)"
echo ""

read -p "Escolhe [1, 2, 3 ou 4]: " CHOICE

case $CHOICE in
  1)
    echo ""
    echo "✅ Cenário 1: Tudo Local"
    
    # Copiar do .env.example removendo linhas com AWS credentials, VITE vars e comments de DYNAMODB online
    grep -v "^AWS_ACCESS_KEY_ID=" "$ENV_EXAMPLE" | \
    grep -v "^AWS_SECRET_ACCESS_KEY=" | \
    grep -v "^# AWS_ACCESS_KEY_ID=" | \
    grep -v "^# AWS_SECRET_ACCESS_KEY=" | \
    grep -v "^# Para Database ONLINE" | \
    grep -v "^DYNAMODB_ENDPOINT=$" | \
    grep -v "^VITE_API_URL=" | \
    grep -v "^# Para Backend" > "$ENV_FILE"
    
    # Criar frontend/.env apenas com VITE_API_URL
    echo "VITE_API_URL=http://localhost:8001" > frontend/.env
    
    echo "✅ .env criado para Cenário 1"
    echo ""
    echo "🚀 Iniciando DynamoDB Local..."
    bash database/start_dynamodb.sh
    
    echo ""
    echo "⏳ Aguardando DynamoDB iniciar..."
    sleep 3
    
    echo ""
    echo "✅ Criando tabela..."
    bash database/setup_database_local.sh
    echo ""
    echo "Próximos passos:"
    echo "1. Em um terminal, inicia o Backend:"
    echo "   cd backend-aws && python3 main.py"
    echo ""
    echo "2. Em outro terminal, inicia o Frontend:"
    echo "   cd frontend && npm run dev"
    ;;
    
  2)
    echo ""
    echo "✅ Cenário 2: Backend Local + Database Online"
    
    # Copiar do .env.example removendo DYNAMODB_ENDPOINT e VITE vars
    grep -v "^DYNAMODB_ENDPOINT=" "$ENV_EXAMPLE" | \
    grep -v "^# Para Database LOCAL" | \
    grep -v "^# Para Database ONLINE" | \
    grep -v "^VITE_API_URL=" | \
    grep -v "^# Para Backend" > "$ENV_FILE"
    
    # Criar frontend/.env apenas com VITE_API_URL
    echo "VITE_API_URL=http://localhost:8001" > frontend/.env
    
    echo "✅ .env criado para Cenário 2"
    echo ""
    echo "Preenche no .env:"
    echo "  AWS_ACCESS_KEY_ID=<tua_chave>"
    echo "  AWS_SECRET_ACCESS_KEY=<tua_chave>"
    echo "  SECRET_KEY=<chave_gerada_com_openssl>"
    echo ""
    echo "Depois:"
    echo "1. cd backend-aws && python3 main.py"
    echo "2. cd frontend && npm run dev"
    ;;
    
  3)
    echo ""
    echo "✅ Cenário 3: Frontend Local + Backend/Database Online"
    echo ""
    echo "Para dar deploy do backend online, sam build e sam deploy (AWS) ou git push (Railway)."
    echo ""
    
    # Criar apenas frontend/.env com VITE_API_URL online (backend vars estão online)
    grep "^VITE_API_URL=https://" "$ENV_EXAMPLE" > frontend/.env
    
    echo "✅ .env criado para Cenário 3"
    echo ""
    echo "Edita frontend/.env com a URL do teu backend online se necessário"
    echo ""
    echo "Depois:"
    echo "  cd frontend && npm run dev"
    ;;
    
  4)
    echo ""
    echo "✅ Cenário 4: Deploy em Produção"
    echo ""
    echo "Sem .env local necessário!"
    echo ""
    echo "Variáveis de ambiente estão em:"
    echo "  - Vercel (Frontend): VITE_API_URL"
    echo "  - AWS/Railway (Backend): SECRET_KEY, MAIL_*, AWS_*"
    echo ""
    echo "Para fazer deploy:"
    echo "  git push origin preview"
    ;;
    
  *)
    echo "❌ Opção inválida. Escolhe 1, 2, 3 ou 4."
    exit 1
    ;;
esac

echo ""
