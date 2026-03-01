"""
LaTeX editor API routes.

Endpoints:
  GET    /api/latex/files/{workspace_id}           – file tree
  GET    /api/latex/file/{workspace_id}?name=...   – read file
  POST   /api/latex/file/{workspace_id}            – save file
  DELETE /api/latex/file/{workspace_id}?name=...   – delete file
  POST   /api/latex/compile/{workspace_id}         – compile to PDF
  GET    /api/latex/pdf/{workspace_id}             – download / stream compiled PDF
  GET    /api/latex/templates                      – list available templates
  POST   /api/latex/template/{workspace_id}        – apply a template
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from models.workspace import Workspace
from utils.auth_utils import get_current_user
from utils.database import get_db
from utils.latex_compiler import (
    compile_latex,
    delete_file,
    get_file_tree,
    get_pdf_path,
    read_file,
    write_file,
    TEMPLATES,
    DEFAULT_TEMPLATE,
)

router = APIRouter()


# ── helpers ────────────────────────────────

async def _verify_workspace(workspace_id: int, user: User, db: AsyncSession) -> Workspace:
    """Ensure the workspace exists and belongs to the current user."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id, Workspace.user_id == user.id)
    )
    ws = result.scalar_one_or_none()
    if ws is None:
        raise HTTPException(404, "Workspace not found")
    return ws


# ── schemas ────────────────────────────────

class SaveFileRequest(BaseModel):
    filename: str = "main.tex"
    content: str


class CompileResponse(BaseModel):
    success: bool
    pdf_url: str | None = None
    logs: str = ""


class ApplyTemplateRequest(BaseModel):
    template: str = "blank"


# ── routes ─────────────────────────────────

@router.get("/files/{workspace_id}")
async def list_files(
    workspace_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_workspace(workspace_id, user, db)
    return {"files": get_file_tree(workspace_id)}


@router.get("/file/{workspace_id}")
async def get_file(
    workspace_id: int,
    name: str = Query("main.tex"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_workspace(workspace_id, user, db)
    content = read_file(workspace_id, name)
    return {"filename": name, "content": content}


@router.post("/file/{workspace_id}")
async def save_file(
    workspace_id: int,
    body: SaveFileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_workspace(workspace_id, user, db)
    saved_name = write_file(workspace_id, body.filename, body.content)
    return {"filename": saved_name, "message": "Saved"}


@router.delete("/file/{workspace_id}")
async def remove_file(
    workspace_id: int,
    name: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_workspace(workspace_id, user, db)
    ok = delete_file(workspace_id, name)
    if not ok:
        raise HTTPException(400, "Cannot delete this file")
    return {"message": "Deleted"}


@router.post("/compile/{workspace_id}", response_model=CompileResponse)
async def compile(
    workspace_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_workspace(workspace_id, user, db)
    result = await compile_latex(workspace_id)
    pdf_url = f"/api/latex/pdf/{workspace_id}" if result["success"] else None
    return CompileResponse(success=result["success"], pdf_url=pdf_url, logs=result["logs"])


@router.get("/pdf/{workspace_id}")
async def download_pdf(
    workspace_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_workspace(workspace_id, user, db)
    path = get_pdf_path(workspace_id)
    if path is None:
        raise HTTPException(404, "PDF not found — compile first")
    return FileResponse(path, media_type="application/pdf", filename="paper.pdf")


@router.get("/templates")
async def list_templates(user: User = Depends(get_current_user)):
    return {"templates": list(TEMPLATES.keys())}


@router.post("/template/{workspace_id}")
async def apply_template(
    workspace_id: int,
    body: ApplyTemplateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_workspace(workspace_id, user, db)
    tpl = TEMPLATES.get(body.template)
    if tpl is None:
        raise HTTPException(400, f"Unknown template: {body.template}")
    write_file(workspace_id, "main.tex", tpl)
    return {"message": f"Template '{body.template}' applied", "content": tpl}
