from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import Response
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
    pdf_url: Optional[str] = None
    workspace_id: int


# ---------- Helpers ----------

def _embed_paper_background(paper_id: int, content: str):
    """Background task: embed paper content into ChromaDB vector store."""
    try:
        chunk_count = vector_store.add_paper(paper_id, content)
        print(f"[BACKGROUND] Paper {paper_id}: embedded {chunk_count} chunks")
    except Exception as e:
        print(f"[WARNING] Background embedding failed for paper {paper_id}: {e}")


async def _fetch_pdf_bytes(url: str) -> Optional[bytes]:
    """Try to download a PDF from a URL. Returns bytes or None."""
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            ct = resp.headers.get("content-type", "")
            if "pdf" in ct or url.lower().endswith(".pdf") or resp.content[:5] == b"%PDF-":
                return resp.content
            return None
    except Exception as e:
        print(f"[FETCH_PDF] Failed to download PDF from {url}: {e}")
        return None


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

        # Best available direct PDF link
        pdf_url = (
            primary_location.get("pdf_url")
            or work.get("open_access", {}).get("oa_url")
            or ""
        )
        # Also scan other locations for a pdf_url
        if not pdf_url:
            for loc in work.get("locations", []):
                if loc.get("pdf_url"):
                    pdf_url = loc["pdf_url"]
                    break

        papers.append({
            "title": work.get("title", "Untitled"),
            "authors": authors,
            "abstract": abstract,
            "doi": work.get("doi"),
            "url": url,
            "pdf_url": pdf_url,
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

    # Try to fetch the actual PDF if an open-access URL is available
    pdf_bytes = await _fetch_pdf_bytes(body.pdf_url)

    # Extract text from fetched PDF for search / embeddings
    content = ""
    if pdf_bytes:
        try:
            reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            pages = [p.extract_text() or "" for p in reader.pages]
            content = "\n".join(pages).replace("\x00", "")
        except Exception as e:
            print(f"[IMPORT] PDF text extraction failed: {e}")

    paper = Paper(
        title=body.title,
        authors=body.authors,
        abstract=body.abstract,
        url=body.url,
        doi=body.doi,
        published_date=body.published_date,
        content=content or body.abstract or "",
        pdf_data=pdf_bytes,
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
            "has_pdf": pdf_bytes is not None,
        },
    }


@router.post("/upload")
async def upload_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    workspace_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import traceback as _tb
    print(f"[UPLOAD] START  user={current_user.id}  ws={workspace_id}  file={file.filename}")
    try:
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
            print(f"[UPLOAD] Read {len(pdf_bytes)} bytes from PDF")
            reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            text_pages = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_pages.append(page_text)
            content = "\n".join(text_pages)
            # PostgreSQL rejects NUL bytes (0x00) in text columns
            content = content.replace("\x00", "")
            print(f"[UPLOAD] Extracted {len(content)} chars from {len(reader.pages)} pages")
        except Exception as e:
            print(f"[UPLOAD] PDF read error: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")

        # Use filename as title (without .pdf extension)
        title = file.filename.rsplit(".", 1)[0] if file.filename else "Uploaded Document"

        paper = Paper(
            title=title,
            content=content,
            pdf_data=pdf_bytes,
            user_id=current_user.id,
            workspace_id=workspace_id,
        )
        db.add(paper)
        await db.flush()
        await db.refresh(paper)
        print(f"[UPLOAD] Paper saved: id={paper.id}")

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
    except HTTPException:
        raise
    except Exception as e:
        print(f"[UPLOAD] UNHANDLED ERROR: {e}")
        _tb.print_exc()
        raise


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
                "has_pdf": bool(p.pdf_data),
            }
            for p in papers
        ]
    }


@router.get("/{paper_id}/pdf")
async def get_paper_pdf(
    paper_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve the stored PDF for inline preview (Content-Disposition: inline)."""
    result = await db.execute(
        select(Paper).where(Paper.id == paper_id, Paper.user_id == current_user.id)
    )
    paper = result.scalar_one_or_none()
    if not paper or not paper.pdf_data:
        raise HTTPException(status_code=404, detail="PDF not found")

    filename = f"{paper.title or 'paper'}.pdf"
    return Response(
        content=paper.pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{paper_id}/preview")
async def get_paper_content_preview(
    paper_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a text-based content preview for a paper.

    Priority: abstract → stored content (first 1500 chars) → vector store chunks.
    Used by the frontend fallback when the PDF cannot be rendered inline.
    """
    result = await db.execute(
        select(Paper).where(Paper.id == paper_id, Paper.user_id == current_user.id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    preview_text = ""

    # 1. Use stored content (extracted PDF text)
    if paper.content and paper.content.strip():
        preview_text = paper.content.strip()
    else:
        # 2. Try vector store chunks as last resort
        try:
            chunks = vector_store.query_paper(
                paper.id, paper.title or "summary overview", n_results=10
            )
            if chunks:
                preview_text = "\n\n".join(chunks)
        except Exception as e:
            print(f"[PREVIEW] Vector store query failed for paper {paper_id}: {e}")

    return {
        "title": paper.title,
        "authors": paper.authors,
        "published_date": paper.published_date,
        "doi": paper.doi,
        "abstract": paper.abstract or "",
        "content_preview": preview_text[:3000] if preview_text else "",
        "has_full_content": len(preview_text) > 3000 if preview_text else False,
    }


@router.get("/{paper_id}/download")
async def download_paper_pdf(
    paper_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve the stored PDF for download (Content-Disposition: attachment)."""
    result = await db.execute(
        select(Paper).where(Paper.id == paper_id, Paper.user_id == current_user.id)
    )
    paper = result.scalar_one_or_none()
    if not paper or not paper.pdf_data:
        raise HTTPException(status_code=404, detail="PDF not found")

    filename = f"{paper.title or 'paper'}.pdf"
    return Response(
        content=paper.pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class ProxyPdfRequest(BaseModel):
    pdf_url: Optional[str] = None
    url: Optional[str] = None
    doi: Optional[str] = None


@router.post("/proxy-pdf")
async def proxy_pdf(
    body: ProxyPdfRequest,
    current_user: User = Depends(get_current_user),
):
    """Proxy-fetch a PDF from an external URL.

    Tries, in order: pdf_url  ➜  Unpaywall via DOI  ➜  url.
    Returns the raw PDF bytes so the frontend can display them in an iframe
    without CORS / X-Frame-Options issues.
    """
    candidate_urls: list[str] = []
    if body.pdf_url:
        candidate_urls.append(body.pdf_url)
    if body.doi:
        # Unpaywall free API – very reliable for OA PDFs
        clean_doi = body.doi.replace("https://doi.org/", "")
        candidate_urls.append(
            f"https://api.unpaywall.org/v2/{clean_doi}?email=researchhub@example.com"
        )
    if body.url:
        candidate_urls.append(body.url)

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        for target in candidate_urls:
            try:
                # Special handling for Unpaywall (JSON API → gives us the real PDF link)
                if "unpaywall.org" in target:
                    resp = await client.get(target)
                    if resp.status_code == 200:
                        data = resp.json()
                        oa = data.get("best_oa_location") or {}
                        real_pdf = oa.get("url_for_pdf") or oa.get("url")
                        if real_pdf:
                            pdf_resp = await client.get(real_pdf)
                            if pdf_resp.status_code == 200 and (
                                b"%PDF" in pdf_resp.content[:10]
                                or "pdf" in pdf_resp.headers.get("content-type", "")
                            ):
                                return Response(
                                    content=pdf_resp.content,
                                    media_type="application/pdf",
                                    headers={"Content-Disposition": 'inline; filename="paper.pdf"'},
                                )
                    continue

                resp = await client.get(target)
                if resp.status_code == 200 and (
                    b"%PDF" in resp.content[:10]
                    or "pdf" in resp.headers.get("content-type", "")
                ):
                    return Response(
                        content=resp.content,
                        media_type="application/pdf",
                        headers={"Content-Disposition": 'inline; filename="paper.pdf"'},
                    )
            except Exception as e:
                print(f"[PROXY-PDF] Failed for {target}: {e}")
                continue

    raise HTTPException(status_code=404, detail="Could not fetch PDF from any available URL")


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
