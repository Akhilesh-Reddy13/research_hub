from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from utils.database import Base


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    authors = Column(String(1000), nullable=True)
    abstract = Column(Text, nullable=True)
    url = Column(String(1000), nullable=True)
    doi = Column(String(255), nullable=True)
    published_date = Column(String(50), nullable=True)
    content = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    imported_at = Column(DateTime, server_default=func.now())
