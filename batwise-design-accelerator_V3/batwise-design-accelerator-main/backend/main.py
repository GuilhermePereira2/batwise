from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import Requirements, DesignResponse, CellData
from logic import compute_cell_configurations, CELL_CATALOGUE, COMPONENT_DB

app = FastAPI(title="BatWise Design API")

# Configurar CORS (Crítico para funcionar com o React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Aceita tudo em dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "BatWise API is running - Python Version"}

# 1. Endpoint para o DIY Tool (Cálculo)


@app.post("/calculate", response_model=DesignResponse)
def calculate_design(req: Requirements):
    # O Pydantic valida o JSON automaticamente
    configs, stats = compute_cell_configurations(
        req, CELL_CATALOGUE, COMPONENT_DB)

    return {
        "results": configs[:30],    # Top 30
        "plotResults": configs[:100],  # Top 100
        "total": len(configs),
        "stats": stats if req.debug else None
    }

# 2. Endpoint para o Cell Explorer (Lista de Células)
# Isto substitui a parte "if (req.method === 'GET')" do Deno


@app.get("/cells", response_model=list[CellData])
def get_cells():
    return CELL_CATALOGUE
