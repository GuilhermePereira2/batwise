# Backend - BatWise API

FastAPI backend para cálculo de configurações de baterias.

## Estrutura

```
backend/
├── main.py              # API FastAPI
├── cells_loader.py      # Carrega células dos JSON
├── logic.py             # Lógica de cálculo
├── models.py            # Modelos Pydantic
├── security.py          # JWT e passwords
├── .env                 # Config (não commitar!)
├── requirements.txt
├── data/                # Células e componentes
└── test/
    └── start_backend.sh # Script para iniciar
```

## Iniciar

```bash
# Instalar dependências
pip install -r requirements.txt

# Configurar .env (copiar .env.example)
cp .env.example .env

# Iniciar
cd test
./start_backend.sh
```

Acede a http://localhost:8001/docs para ver a API.

## Configuração (.env)

**DynamoDB Local:**
```env
DYNAMODB_ENDPOINT=http://localhost:8000
AWS_REGION=local
USERS_TABLE_NAME=batwise-users
```

**AWS DynamoDB:**
```env
# DYNAMODB_ENDPOINT=     # Comentado
AWS_REGION=eu-west-3
USERS_TABLE_NAME=watt-builder-Users
```

