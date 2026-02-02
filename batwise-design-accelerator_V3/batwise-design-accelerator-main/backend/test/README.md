# Backend Tests

## Iniciar Backend

```bash
./start_backend.sh
```

Configurar em `backend/.env`:
- Com `DYNAMODB_ENDPOINT` → usa DynamoDB Local
- Sem `DYNAMODB_ENDPOINT` → usa AWS DynamoDB

## Testes

```bash
python3 test.py
```

