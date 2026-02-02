# Database - DynamoDB Users

Handler para gestão de utilizadores.

## Usar

```python
from database.dynamodb_handler import db_users

# Criar user
user = db_users.create_user(
    email="user@example.com",
    full_name="Nome",
    hashed_password="hash...",
    credits=5
)

# Buscar
user = db_users.get_user_by_email("user@example.com")

# Deduzir crédito
remaining = db_users.deduct_credit("user@example.com")
```

## Schema

**Primary Key:** `userId` (UUID)

**Atributos:**
- `email`, `full_name`, `hashed_password`
- `credits`, `company` (opcional)
- `created_at`, `updated_at`

## Config

Ver `backend/.env`:
- `DYNAMODB_ENDPOINT` (se DynamoDB Local)
- `AWS_REGION`
- `USERS_TABLE_NAME`

