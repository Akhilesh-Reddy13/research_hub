from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import httpx
import PyPDF2
import io
import re
import xml.etree.ElementTree as ET
from collections import Counter

from utils.database import get_db
from utils.auth_utils import get_current_user
from utils import vector_store
from models.user import User
from models.paper import Paper
from models.workspace import Workspace

router = APIRouter()

# Atom / arXiv XML namespaces
_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
    "opensearch": "http://a9.com/-/spec/opensearch/1.1/",
}


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


def parse_arxiv_results(xml_text: str) -> list:
    """Parse arXiv Atom XML response into a list of paper dicts."""
    papers = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"[ARXIV] XML parse error: {e}")
        return []

    for entry in root.findall("atom:entry", _NS):
        # Detect arXiv error entries
        title_el = entry.find("atom:title", _NS)
        title = (title_el.text or "Untitled").strip().replace("\n", " ") if title_el is not None else "Untitled"
        title = re.sub(r"\s+", " ", title)

        if title.lower() == "error":
            continue  # skip error entries

        # Authors
        author_names = []
        for author_el in entry.findall("atom:author", _NS):
            name_el = author_el.find("atom:name", _NS)
            if name_el is not None and name_el.text:
                author_names.append(name_el.text.strip())
        authors = ", ".join(author_names) if author_names else "Unknown"

        # Abstract
        summary_el = entry.find("atom:summary", _NS)
        abstract = (summary_el.text or "").strip() if summary_el is not None else ""

        # Published date — truncate to YYYY-MM-DD
        pub_el = entry.find("atom:published", _NS)
        published_date = ""
        if pub_el is not None and pub_el.text:
            published_date = pub_el.text.strip()[:10]

        # URL (abstract page)
        id_el = entry.find("atom:id", _NS)
        url = (id_el.text or "").strip() if id_el is not None else ""

        # PDF URL — look for <link> with title="pdf"
        pdf_url = ""
        for link_el in entry.findall("atom:link", _NS):
            if link_el.get("title") == "pdf":
                pdf_url = link_el.get("href", "")
                break
        # Fallback: derive PDF URL from the abstract URL
        if not pdf_url and url:
            pdf_url = url.replace("/abs/", "/pdf/")

        # DOI — <arxiv:doi> element or <link title="doi">
        doi = ""
        doi_el = entry.find("arxiv:doi", _NS)
        if doi_el is not None and doi_el.text:
            doi = doi_el.text.strip()
        if not doi:
            for link_el in entry.findall("atom:link", _NS):
                if link_el.get("title") == "doi":
                    doi = link_el.get("href", "")
                    break

        # Category
        category = ""
        cat_el = entry.find("arxiv:primary_category", _NS)
        if cat_el is not None:
            category = cat_el.get("term", "")

        papers.append({
            "title": title,
            "authors": authors,
            "abstract": abstract,
            "doi": doi or None,
            "url": url,
            "pdf_url": pdf_url,
            "published_date": published_date or None,
            "category": category,
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
                "https://export.arxiv.org/api/query",
                params={
                    "search_query": f"all:{query}",
                    "start": 0,
                    "max_results": 20,
                    "sortBy": "relevance",
                    "sortOrder": "descending",
                },
            )
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Error querying arXiv: {str(e)}")

    papers = parse_arxiv_results(resp.text)
    return {"papers": papers}


# ---------- Hybrid Search Helpers ----------

def _tokenize(text: str) -> list[str]:
    """Lowercase tokenization, stripping non-alphanumeric chars."""
    return re.findall(r"[a-z0-9]+", text.lower())


def _keyword_score(query_tokens: list[str], paper) -> float:
    """Compute a keyword relevance score for a paper (0-1).

    Weights: title match = 3x, author match = 2x, abstract match = 1x.
    Score = weighted hits / (len(query_tokens) * max_weight) so it stays 0-1.
    """
    if not query_tokens:
        return 0.0

    title_tokens = set(_tokenize(paper.title or ""))
    author_tokens = set(_tokenize(paper.authors or ""))
    abstract_tokens = set(_tokenize(paper.abstract or ""))

    score = 0.0
    for qt in query_tokens:
        if qt in title_tokens:
            score += 3.0
        if qt in author_tokens:
            score += 2.0
        if qt in abstract_tokens:
            score += 1.0

    max_possible = len(query_tokens) * 6.0  # 3 + 2 + 1
    return min(score / max_possible, 1.0) if max_possible > 0 else 0.0


@router.get("/search/hybrid")
async def hybrid_search_papers(
    query: str,
    workspace_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search user's own papers using hybrid keyword + semantic ranking.

    Returns papers sorted by combined score (0.4 keyword + 0.6 semantic).
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query parameter is required")

    # Fetch user's papers (optionally filtered by workspace)
    stmt = select(Paper).where(Paper.user_id == current_user.id)
    if workspace_id is not None:
        stmt = stmt.where(Paper.workspace_id == workspace_id)
    result = await db.execute(stmt)
    papers = result.scalars().all()

    if not papers:
        return {"papers": []}

    query_tokens = _tokenize(query)
    paper_ids = [p.id for p in papers]

    # --- Keyword scoring ---
    keyword_scores: dict[int, float] = {}
    for p in papers:
        keyword_scores[p.id] = _keyword_score(query_tokens, p)

    # --- Semantic scoring (via ChromaDB) ---
    semantic_scores: dict[int, float] = {}
    try:
        semantic_scores = vector_store.semantic_search_all(query, paper_ids, n_results=100)
    except Exception as e:
        print(f"[HYBRID SEARCH] Semantic scoring failed, using keyword only: {e}")

    # --- Combine scores ---
    KEYWORD_WEIGHT = 0.4
    SEMANTIC_WEIGHT = 0.6

    scored_papers = []
    for p in papers:
        kw = keyword_scores.get(p.id, 0.0)
        sem = semantic_scores.get(p.id, 0.0)
        combined = (KEYWORD_WEIGHT * kw) + (SEMANTIC_WEIGHT * sem)

        # Only include papers with some relevance
        if combined > 0.01 or kw > 0:
            scored_papers.append({
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
                "relevance_score": round(combined, 4),
                "keyword_score": round(kw, 4),
                "semantic_score": round(sem, 4),
            })

    # Sort by combined score descending
    scored_papers.sort(key=lambda x: x["relevance_score"], reverse=True)

    return {"papers": scored_papers}


@router.post("/import")
async def import_paper(
    body: PaperImport,
    background_tasks: BackgroundTasks,
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

    # Embed paper content into ChromaDB for semantic search
    embed_text = content or body.abstract or ""
    if embed_text.strip():
        background_tasks.add_task(_embed_paper_background, paper.id, embed_text)

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
