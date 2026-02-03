"""
Script de Teste para o Backend BatteryApp
Este script testa os principais endpoints e mostra o que está a acontecer
"""

import sys
import os
import json
from pathlib import Path
import tracemalloc



# Adiciona o diretório pai ao path para importar os módulos
sys.path.insert(0, str(Path(__file__).parent.parent))

# ============================================================================
# 1. TESTE DA BASE DE DADOS
# ============================================================================
print("\n" + "="*70)
print("1️⃣  TESTANDO BASE DE DADOS")
print("="*70)

try:
    from database import db
    print(f"✅ Base de dados carregada com sucesso!")
    print(f"   📊 Total de células: {len(db.cells)}")
    print(f"   📊 Total de fusíveis: {len(db.components.get('fuses', []))}")
    print(f"   📊 Total de relés: {len(db.components.get('relays', []))}")
    print(f"   📊 Total de cabos: {len(db.components.get('cables', []))}")
    print(f"   📊 Total de BMS: {len(db.components.get('bms', []))}")
    
    # Mostrar primeira célula como exemplo
    if db.cells:
        first_cell = db.cells[0]
        print(f"\n   📦 Exemplo de célula (primeira):")
        print(f"      Marca: {first_cell.Brand if hasattr(first_cell, 'Brand') else 'N/A'}")
        print(f"      Modelo: {first_cell.CellModelNo if hasattr(first_cell, 'CellModelNo') else 'N/A'}")
        print(f"      Voltagem: {first_cell.NominalVoltage if hasattr(first_cell, 'NominalVoltage') else 'N/A'}")
        print(f"      Capacidade: {first_cell.Capacity if hasattr(first_cell, 'Capacity') else 'N/A'}")
except Exception as e:
    print(f"❌ Erro ao carregar base de dados: {e}")
    import traceback
    traceback.print_exc()


# ============================================================================
# 2. TESTE DOS MODELOS
# ============================================================================
print("\n" + "="*70)
print("2️⃣  TESTANDO MODELOS PYDANTIC")
print("="*70)

try:
    from models import Requirements
    
    # Criar um Requirements de teste
    test_req = Requirements(
        min_voltage=48,
        max_voltage=60,
        min_continuous_power=1000,
        max_weight=10,
        max_height=30,
        max_width=50,
        max_length=50,
        max_price=5000,
        ambient_temp=25,
        include_components=True,
        debug=True
    )
    
    print(f"✅ Modelo Requirements criado com sucesso!")
    print(f"   Voltagem: {test_req.min_voltage}V - {test_req.max_voltage}V")
    print(f"   Potência contínua mínima: {test_req.min_continuous_power}W")
    print(f"   Peso máximo: {test_req.max_weight}kg")
    
except Exception as e:
    print(f"❌ Erro ao testar modelos: {e}")
    import traceback
    traceback.print_exc()


# ============================================================================
# 3. TESTE DA LÓGICA DE CÁLCULO
# ============================================================================
print("\n" + "="*70)
print("3️⃣  TESTANDO LÓGICA DE CÁLCULO")
print("="*70)

try:
    from logic import compute_cell_configurations, get_integer_factors
    from models import Requirements
    from database import db
    
    print("⏳ Executando cálculo de configurações...")
    
    test_req = Requirements(
        min_voltage=32,
        max_voltage=60,
        min_continuous_power=3000,
        max_weight=150,
        max_height=300,
        max_width=500,
        max_length=500,
        max_price=3000,
        ambient_temp=25,
        include_components=True,
        debug=True
    )

    tracemalloc.start()
    result = compute_cell_configurations(test_req, db.cells, db.components)
    current, peak = tracemalloc.get_traced_memory()
    print(f"Pico de memória da função: {peak / 1024 / 1024:.2f} MB")
    tracemalloc.stop()
    
    print(f"✅ Cálculo concluído com sucesso!")
    print(f"   🔢 Total de configurações válidas: {result['total']}")
    print(f"   📊 Tentativas: {result['stats']['totalAttempts']}")
    
    if result['results']:
        best_config = result['results'][0]
        print(f"\n   ⭐ MELHOR CONFIGURAÇÃO (melhor preço/energia):")
        print(f"      Série: {best_config.series_cells} | Paralelo: {best_config.parallel_cells}")
        print(f"      Voltagem: {best_config.battery_voltage}V")
        print(f"      Capacidade: {best_config.battery_capacity}Ah")
        print(f"      Energia: {best_config.battery_energy}Wh")
        print(f"      Peso: {best_config.battery_weight}kg")
        print(f"      Preço: €{best_config.total_price}")
        print(f"      Segurança: {best_config.safety.safety_score}/100")
    else:
        print("   ⚠️  Nenhuma configuração válida encontrada")

    factors = get_integer_factors(60)
        
except Exception as e:
    print(f"❌ Erro ao testar lógica de cálculo: {e}")
    import traceback
    traceback.print_exc()


# ============================================================================
# 4. TESTE DO SERVIDOR FASTAPI (sem precisar de estar a correr)
# ============================================================================
print("\n" + "="*70)
print("4️⃣  VERIFICAÇÃO DO SERVIDOR FASTAPI")
print("="*70)

try:
    from main import app
    from fastapi.testclient import TestClient
    
    print("✅ Aplicação FastAPI carregada com sucesso!")
    print(f"   🔗 Título: {app.title}")
    
    # Criar cliente de teste
    client = TestClient(app)
    
    print("\n   Testando endpoints:")
    
    # Teste 1: GET /
    response = client.get("/")
    print(f"\n   GET / → Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"      Status: {data.get('status')}")
        print(f"      Células na BD: {data.get('database_stats', {}).get('cells')}")
    
    # Teste 2: GET /cells
    response = client.get("/cells")
    print(f"\n   GET /cells → Status: {response.status_code}")
    if response.status_code == 200:
        print(f"      Total de células retornadas: {len(response.json())}")
    
    # Teste 3: POST /calculate
    print(f"\n   POST /calculate → Testando...")
    
    payload = {
        "min_voltage": 32,
        "max_voltage": 60,
        "min_continuous_power": 3000,
        "max_weight": 150,
        "max_height": 300,
        "max_width": 500,
        "max_length": 500,
        "max_price": 3000,
        "ambient_temp": 25,
        "include_components": True,
        "debug": False
    }
    
    response = client.post("/calculate", json=payload)
    print(f"      Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"      Configurações válidas: {data.get('total')}")
        if data.get('results'):
            config = data['results'][0]
            print(f"      Melhor config: {config['series_cells']}s{config['parallel_cells']}p @ {config['battery_voltage']}V")
    else:
        print(f"      ❌ Erro: {response.text}")
    
except ImportError as e:
    print(f"⚠️  Não foi possível importar FastAPI TestClient: {e}")
    print("   (Verifique se o FastAPI está instalado)")
except Exception as e:
    print(f"❌ Erro ao testar FastAPI: {e}")
    import traceback
    traceback.print_exc()


# ============================================================================
# 5. RESUMO
# ============================================================================
print("\n" + "="*70)
print("✅ TESTE CONCLUÍDO!")
print("="*70)
print("\n📝 Resumo:")
print("   • A base de dados carrega com sucesso")
print("   • Os modelos Pydantic funcionam corretamente")
print("   • A lógica de cálculo produz configurações válidas")
print("   • O servidor FastAPI está funcionando")
print("\n🔧 Próximos passos:")
print("   1. Se houver erros acima, verifique as mensagens")
print("   2. Para correr o servidor: python3 main.py")
print("   3. Para testar endpoints: curl ou Postman")
print("   4. Ou use: python3 -m uvicorn main:app --reload")
print("\n")
