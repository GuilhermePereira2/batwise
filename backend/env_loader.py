from pathlib import Path
from dotenv import load_dotenv


def load_backend_env() -> None:
    """
    Carrega variáveis de ambiente do .env na raiz.
    Procura em ordem: ../.env (raiz do projeto)
    """
    backend_dir = Path(__file__).resolve().parent
    root_dir = backend_dir.parent

    # Procura na raiz do projeto
    root_env = root_dir / ".env"
    if root_env.exists():
        load_dotenv(dotenv_path=root_env)
        return
