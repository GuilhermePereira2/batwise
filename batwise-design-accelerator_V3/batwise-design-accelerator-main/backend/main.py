from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import Requirements, DesignResponse
from logic import calculate_design

app = FastAPI(title="BatWise Design API")

# Configurar CORS para o teu frontend poder falar com este backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, coloca o URL do teu Vercel aqui
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "BatWise API is running"}


@app.post("/calculate", response_model=DesignResponse)
def calculate(req: Requirements):
    # O Pydantic valida o JSON de entrada automaticamente
    return calculate_design(req)

# Para correr localmente:
# uvicorn main:app --reload
