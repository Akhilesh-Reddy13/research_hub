from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func as sa_func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from utils.database import get_db
from utils.auth_utils import get_current_user
from models.user import User
from models.workspace import Workspace
from models.paper import Paper
from models.conversation import Conversation

router = APIRouter()


# ---------- Pydantic schemas ----------

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ---------- Endpoints ----------

@router.post("/")
async def create_workspace(
    body: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = Workspace(
        name=body.name,
        description=body.description,
        user_id=current_user.id,
    )
    db.add(workspace)
    await db.flush()
    await db.refresh(workspace)
    return {
        "id": workspace.id,
        "name": workspace.name,
        "description": workspace.description,
        "user_id": workspace.user_id,
        "created_at": str(workspace.created_at),
    }


@router.get("/")
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Workspaces with paper counts
    result = await db.execute(
        select(Workspace).where(Workspace.user_id == current_user.id)
    )
    workspaces = result.scalars().all()

    workspace_list = []
    for ws in workspaces:
        count_result = await db.execute(
            select(sa_func.count(Paper.id)).where(Paper.workspace_id == ws.id)
        )
        paper_count = count_result.scalar() or 0
        workspace_list.append({
            "id": ws.id,
            "name": ws.name,
            "description": ws.description,
            "user_id": ws.user_id,
            "created_at": str(ws.created_at),
            "paper_count": paper_count,
        })

    return {"workspaces": workspace_list}


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    count_result = await db.execute(
        select(sa_func.count(Paper.id)).where(Paper.workspace_id == workspace.id)
    )
    paper_count = count_result.scalar() or 0

    return {
        "id": workspace.id,
        "name": workspace.name,
        "description": workspace.description,
        "user_id": workspace.user_id,
        "created_at": str(workspace.created_at),
        "paper_count": paper_count,
    }


@router.put("/{workspace_id}")
async def update_workspace(
    workspace_id: int,
    body: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if body.name is not None:
        workspace.name = body.name
    if body.description is not None:
        workspace.description = body.description

    await db.flush()
    await db.refresh(workspace)
    return {
        "id": workspace.id,
        "name": workspace.name,
        "description": workspace.description,
        "user_id": workspace.user_id,
        "created_at": str(workspace.created_at),
    }


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Delete associated conversations and papers first
    await db.execute(
        delete(Conversation).where(Conversation.workspace_id == workspace_id)
    )
    await db.execute(
        delete(Paper).where(Paper.workspace_id == workspace_id)
    )
    await db.delete(workspace)
    await db.flush()

    return {"message": "Workspace deleted successfully"}
