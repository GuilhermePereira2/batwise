import os
from pathlib import Path
from dotenv import load_dotenv


def _preserve_external_aws_profile(before_profile: str | None, before_default_profile: str | None) -> None:
    """
    AWS_PROFILE in .env should not force a local account.
    Let boto3 use the machine's configured default credential chain unless the
    shell already exported a profile before loading .env.
    """
    if before_profile is None:
        os.environ.pop("AWS_PROFILE", None)
    else:
        os.environ["AWS_PROFILE"] = before_profile

    if before_default_profile is None:
        os.environ.pop("AWS_DEFAULT_PROFILE", None)
    else:
        os.environ["AWS_DEFAULT_PROFILE"] = before_default_profile


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
        before_profile = os.environ.get("AWS_PROFILE")
        before_default_profile = os.environ.get("AWS_DEFAULT_PROFILE")
        load_dotenv(dotenv_path=root_env, override=True)
        _preserve_external_aws_profile(before_profile, before_default_profile)
        return
