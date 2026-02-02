"""
Script de teste para verificar a integração com DynamoDB
"""
import os
import sys

# Adicionar path para imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

# Definir variáveis de ambiente para teste local
os.environ['DYNAMODB_ENDPOINT'] = 'http://localhost:8000'
os.environ['AWS_REGION'] = 'local'
os.environ['USERS_TABLE_NAME'] = 'batwise-users'

from dynamodb_handler import db_users
from backend.security import get_password_hash, verify_password

def test_user_operations():
    """Testa todas as operações de utilizador"""
    
    print("="*60)
    print("🧪 Teste de Operações DynamoDB")
    print("="*60)
    print()
    
    test_email = "test@batwise.com"
    test_password = "senha_super_segura_123"
    
    # 1. Criar utilizador
    print("1️⃣  Criando utilizador...")
    try:
        hashed_pwd = get_password_hash(test_password)
        user = db_users.create_user(
            email=test_email,
            full_name="João Teste",
            company="Batwise Inc",
            hashed_password=hashed_pwd,
            credits=10
        )
        print(f"   ✅ Utilizador criado: {user['email']}")
        print(f"   📊 Créditos: {user['credits']}")
    except ValueError as e:
        print(f"   ⚠️  {e} (provavelmente já existe)")
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False
    
    print()
    
    # 2. Buscar utilizador
    print("2️⃣  Buscando utilizador...")
    try:
        user = db_users.get_user_by_email(test_email)
        if user:
            print(f"   ✅ Encontrado: {user['full_name']}")
            print(f"   📧 Email: {user['email']}")
            print(f"   🏢 Empresa: {user.get('company', 'N/A')}")
            print(f"   💰 Créditos: {user['credits']}")
        else:
            print(f"   ❌ Utilizador não encontrado")
            return False
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False
    
    print()
    
    # 3. Verificar password
    print("3️⃣  Verificando password...")
    try:
        is_valid = verify_password(test_password, user['hashed_password'])
        if is_valid:
            print(f"   ✅ Password correta")
        else:
            print(f"   ❌ Password incorreta")
            return False
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False
    
    print()
    
    # 4. Deduzir crédito
    print("4️⃣  Deduzindo 1 crédito...")
    try:
        credits_before = user['credits']
        new_credits = db_users.deduct_credit(test_email)
        print(f"   ✅ Crédito deduzido")
        print(f"   📊 Antes: {credits_before} → Depois: {new_credits}")
    except ValueError as e:
        print(f"   ❌ {e}")
        return False
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False
    
    print()
    
    # 5. Adicionar créditos
    print("5️⃣  Adicionando 5 créditos...")
    try:
        new_credits = db_users.add_credits(test_email, 5)
        print(f"   ✅ Créditos adicionados")
        print(f"   💰 Total atual: {new_credits}")
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False
    
    print()
    
    # 6. Verificar existência
    print("6️⃣  Verificando se utilizador existe...")
    try:
        exists = db_users.user_exists(test_email)
        if exists:
            print(f"   ✅ Utilizador existe")
        else:
            print(f"   ❌ Utilizador não existe")
            return False
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False
    
    print()
    
    # 7. Limpar (opcional - descomentar para remover utilizador de teste)
    # print("7️⃣  Removendo utilizador de teste...")
    # try:
    #     deleted = db_users.delete_user(test_email)
    #     if deleted:
    #         print(f"   ✅ Utilizador removido")
    #     else:
    #         print(f"   ⚠️  Utilizador não encontrado")
    # except Exception as e:
    #     print(f"   ❌ Erro: {e}")
    
    print()
    print("="*60)
    print("✅ Todos os testes passaram!")
    print("="*60)
    return True


if __name__ == "__main__":
    try:
        success = test_user_operations()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Testes interrompidos pelo utilizador")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Erro fatal: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
