# Database Tests

Testes do DynamoDB handler (gestão de users).

## DynamoDB Local

Ficheiros para rodar DynamoDB offline:
- `DynamoDBLocal.jar` - Servidor DynamoDB Local
- `DynamoDBLocal_lib/` - Bibliotecas nativas

### Iniciar DynamoDB Local

```bash
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -port 8000
```

## Setup (primeira vez)

```bash
# Criar tabela no DynamoDB Local
./setup_database_local.sh
```

## Scripts

### Ver utilizadores
```bash
python3 view_database.py
```

### Testar operações CRUD
```bash
python3 test_dynamodb.py
```

## Configuração

Configurar em `backend/.env`:

**DynamoDB Local:**
```env
DYNAMODB_ENDPOINT=http://localhost:8000
AWS_REGION=local
USERS_TABLE_NAME=watt-builder-Users
```

**AWS:**
```env
# DYNAMODB_ENDPOINT=     # Comentar
AWS_REGION=eu-west-3
USERS_TABLE_NAME=watt-builder-Users
```

