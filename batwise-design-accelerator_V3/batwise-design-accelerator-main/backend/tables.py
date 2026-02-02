from sqlalchemy import Column, Integer, String
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    company = Column(String, nullable=True)
    hashed_password = Column(String)
    # Créditos associados à conta (default 5 para começar)
    credits = Column(Integer, default=5)
