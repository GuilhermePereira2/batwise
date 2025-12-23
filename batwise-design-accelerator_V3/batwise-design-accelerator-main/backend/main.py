import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any

# Importar Modelos (Inputs/Outputs)
from models import Requirements, Configuration, DesignResponse, CellData

# Importar Lógica de Cálculo
from logic import compute_cell_configurations

# --- A GRANDE MUDANÇA ESTÁ AQUI ---
# Em vez de importar listas, importamos a nossa "Base de Dados" viva
from database import db

app = FastAPI(title="BatteryApp Calculator API")

# Configurar CORS (Para o teu frontend no Vercel conseguir falar com este backend)
origins = [
    "http://localhost:5173",  # Localhost
    # O teu URL do Vercel (ajusta se for diferente)
    "https://www.watt-builder.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    """Endpoint de saúde para verificar se os dados carregaram bem."""
    return {
        "status": "Operational 🚀",
        "database_stats": {
            "cells": len(db.cells),
            "fuses": len(db.components.get("fuses", [])),
            "relays": len(db.components.get("relays", [])),
            "cables": len(db.components.get("cables", []))
        }
    }


@app.get("/cells", response_model=List[CellData])
def get_all_cells():
    """
    Retorna a lista completa de células disponíveis na base de dados.
    O Frontend usa isto para popular a página 'Cell Explorer'.
    """
    if not db.cells:
        # Opcional: Retornar lista vazia ou erro se não houver dados
        return []
    return db.cells


@app.post("/calculate", response_model=DesignResponse)
def calculate_endpoint(req: Requirements):
    try:
        res = compute_cell_configurations(
            req,
            db.cells,
            db.components
        )

        return res

    except Exception as e:
        import traceback
        print("❌ Erro crítico no cálculo:")
        traceback.print_exc()   # <---- ATIVAR LOGGING AQUI
        raise HTTPException(status_code=500, detail=str(e))


# --- Endpoint Bónus: Recarregar Dados sem desligar o servidor ---


@app.post("/admin/reload-data")
def reload_data():
    """
    Útil para quando editares o ficheiro .json e quiseres atualizar
    os dados sem ter de parar e arrancar o python.
    """
    try:
        db.reload()
        return {"message": "Base de dados recarregada com sucesso!", "stats": len(db.cells)}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao recarregar: {str(e)}")


if __name__ == "__main__":
    # Corre o servidor na porta 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
