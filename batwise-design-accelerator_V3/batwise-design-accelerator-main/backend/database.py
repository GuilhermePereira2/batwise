import json
import os
from typing import List, Dict
from models import CellData, Fuse, Relay, Cable, Bms, Shunt

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- ADIÇÃO: Configuração SQLite ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./users.db"

# connect_args={"check_same_thread": False} é necessário apenas para SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Caminhos para os ficheiros
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")


def load_json_file(filename: str):
    file_path = os.path.join(DATA_DIR, filename)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(
            f"❌ ERRO CRÍTICO: Ficheiro {filename} não encontrado em {DATA_DIR}")
        return []
    except json.JSONDecodeError:
        print(f"❌ ERRO CRÍTICO: JSON inválido em {filename}")
        return []


class Database:
    def __init__(self):
        self.cells: List[CellData] = []
        self.components: Dict[str, List] = {}
        self.reload()

    def reload(self):
        """Carrega os dados do disco para a memória RAM"""
        print("🔄 Loading database...")

        # 1. Carregar Células
        raw_cells = load_json_file("cells.json")
        # Validação automática com Pydantic
        self.cells = [CellData(**c) for c in raw_cells]

        # 2. Carregar Componentes
        raw_comps = load_json_file("components.json")

        self.components = {
            "fuses": [Fuse(**c) for c in raw_comps.get("fuses", [])],
            "relays": [Relay(**c) for c in raw_comps.get("relays", [])],
            "cables": [Cable(**c) for c in raw_comps.get("cables", [])],
            "bms": [Bms(**c) for c in raw_comps.get("bms", [])],
            "shunts": [Shunt(**c) for c in raw_comps.get("shunts", [])]
        }

        print(
            f"✅ Database Loaded: {len(self.cells)} Cells, {len(self.components['fuses'])} Fuses, etc.")


# Criar uma instância global para ser usada na App
db = Database()
