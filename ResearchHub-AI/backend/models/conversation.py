from sqlalchemy import Column, Integer, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from utils.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_message = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    is_web_search = Column(Boolean, default=False, nullable=False, server_default="0")
    created_at = Column(DateTime, server_default=func.now())
