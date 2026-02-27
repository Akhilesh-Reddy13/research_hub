from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import httpx
import PyPDF2
import io

from utils.database import get_db
from utils.auth_utils import get_current_user
from utils import vector_store
from models.user import User
from models.paper import Paper
from models.workspace import Workspace

router = APIRouter()


# ---------- Pydantic schemas ----------

class PaperImport(BaseModel):
    title: str
    authors: str
    abstract: str
    url: str
    doi: Optional[str] = None
    published_date: Optional[str] = None
    workspace_id: int


# ---------- Helpers ----------

def _embed_paper_background(paper_id: int, content: str):
    """Background task: embed paper content into ChromaDB vector store."""
    try:
        chunk_count = vector_store.add_paper(paper_id, content)
        print(f"[BACKGROUND] Paper {paper_id}: embedded {chunk_count} chunks")
    except Exception as e:
        print(f"[WARNING] Background embedding failed for paper {paper_id}: {e}")


def reconstruct_abstract(inverted_index: dict) -> str:
    """Reconstruct abstract text from OpenAlex inverted index format."""
    if not inverted_index:
        return ""
    words = {}
    for word, positions in inverted_index.items():
        for pos in positions:
            words[pos] = word
    return " ".join(words[i] for i in sorted(words.keys()))


def parse_openalex_results(data: dict) -> list:
    """Parse OpenAlex API response into list of paper dicts."""
    papers = []
    for work in data.get("results", []):
        authors = ", ".join(
            a.get("author", {}).get("display_name", "Unknown")
            for a in work.get("authorships", [])
        )
        abstract = reconstruct_abstract(work.get("abstract_inverted_index"))

        # Get URL – prefer landing page, fallback to DOI
        primary_location = work.get("primary_location") or {}
        url = (
            primary_location.get("landing_page_url")
            or work.get("doi")
            or ""
        )

        papers.append({
            "title": work.get("title", "Untitled"),
            "authors": authors,
            "abstract": abstract,
            "doi": work.get("doi"),
            "url": url,
            "published_date": work.get("publication_date"),
        })
    return papers


# ---------- Endpoints ----------

@router.get("/search")
async def search_papers(
    query: str,
    current_user: User = Depends(get_current_user),
):
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query parameter is required")

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.get(
                "https://api.openalex.org/works",
                params={"search": query, "per_page": 20},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Error querying OpenAlex: {str(e)}")

    papers = parse_openalex_results(data)
    return {"papers": papers}


@router.post("/import")
async def import_paper(
    body: PaperImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify workspace belongs to user
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == body.workspace_id,
            Workspace.user_id == current_user.id,
        )
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    paper = Paper(
        title=body.title,
        authors=body.authors,
        abstract=body.abstract,
        url=body.url,
        doi=body.doi,
        published_date=body.published_date,
        user_id=current_user.id,
        workspace_id=body.workspace_id,
    )
    db.add(paper)
    await db.flush()
    await db.refresh(paper)

    return {
        "message": "Paper imported successfully",
        "paper": {
            "id": paper.id,
            "title": paper.title,
            "authors": paper.authors,
            "abstract": paper.abstract,
            "url": paper.url,
            "doi": paper.doi,
            "published_date": paper.published_date,
            "workspace_id": paper.workspace_id,
            "imported_at": str(paper.imported_at),
        },
    }


@router.post("/upload")
async def upload_paper(
    file: UploadFile = File(...),
    workspace_id: int = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify workspace belongs to user
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Read and extract text from PDF
    try:
        pdf_bytes = await file.read()
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        text_pages = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_pages.append(page_text)
        content = "\n".join(text_pages)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")

    # Use filename as title (without .pdf extension)
    title = file.filename.rsplit(".", 1)[0] if file.filename else "Uploaded Document"

    paper = Paper(
        title=title,
        content=content,
        user_id=current_user.id,
        workspace_id=workspace_id,
    )
    db.add(paper)
    await db.flush()
    await db.refresh(paper)

    # Embed PDF content into ChromaDB in the background (non-blocking)
    if content.strip():
        background_tasks.add_task(_embed_paper_background, paper.id, content)

    return {
        "message": "Paper uploaded successfully",
        "paper": {
            "id": paper.id,
            "title": paper.title,
            "content_length": len(content),
            "workspace_id": paper.workspace_id,
            "imported_at": str(paper.imported_at),
        },
    }


@router.get("/workspace/{workspace_id}")
async def list_papers_in_workspace(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify workspace belongs to user
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    papers_result = await db.execute(
        select(Paper).where(Paper.workspace_id == workspace_id)
    )
    papers = papers_result.scalars().all()

    return {
        "papers": [
            {
                "id": p.id,
                "title": p.title,
                "authors": p.authors,
                "abstract": p.abstract,
                "url": p.url,
                "doi": p.doi,
                "published_date": p.published_date,
                "workspace_id": p.workspace_id,
                "imported_at": str(p.imported_at),
                "has_content": bool(p.content),
            }
            for p in papers
        ]
    }


@router.delete("/{paper_id}")
async def delete_paper(
    paper_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Paper).where(
            Paper.id == paper_id,
            Paper.user_id == current_user.id,
        )
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Clean up vector embeddings if paper had content
    try:
        vector_store.delete_paper(paper.id)
    except Exception as e:
        print(f"[WARNING] Failed to delete embeddings for paper {paper.id}: {e}")

    await db.delete(paper)
    await db.flush()
    return {"message": "Paper deleted successfully"}
