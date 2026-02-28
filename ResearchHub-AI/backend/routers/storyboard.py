"""
Visual Summary Router (Academic Pipeline)
--------------------------------------------
Orchestrates the 3-agent academic pipeline:
  1. Summary Agent → structured academic summary + paper classification
  2. Diagram Agent → Mermaid diagram code generation
  3. PDF Generator → professional academic PDF with rendered diagrams

Route prefix: /api/storyboard  (kept for frontend compatibility)
"""

import uuid
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from utils.database import get_db
from utils.auth_utils import get_current_user
from utils import vector_store
from models.user import User
from models.workspace import Workspace
from models.paper import Paper
from agents.summary_agent import generate_structured_summary
from agents.diagram_agent import generate_diagrams, regenerate_single_diagram, render_diagram_to_png, DIAGRAMS_DIR
from agents.pdf_generator import generate_pdf, PDF_DIR

router = APIRouter()


# ── Pydantic schemas ──

class GenerateRequest(BaseModel):
    workspace_id: int


class SummarySection(BaseModel):
    paper_type: str
    structured_summary: str
    key_contributions: list[str]
    methodology: str
    results: str


class DiagramOut(BaseModel):
    title: str
    diagram_type: str
    mermaid_code: str
    description: str


class VisualSummaryResponse(BaseModel):
    session_id: str
    summary: SummarySection
    diagrams: list[DiagramOut]
    pdf_ready: bool = False


# ── Helper ──

def _build_paper_text(papers, retrieved_chunks: dict | None = None) -> str:
    """Combine paper content for the agents."""
    parts = []
    for p in papers:
        part = f"Title: {p.title}\nAuthors: {p.authors or 'N/A'}\nAbstract: {p.abstract or 'N/A'}"
        if retrieved_chunks and p.id in retrieved_chunks:
            chunks = retrieved_chunks[p.id]
            part += "\nKey Content:\n" + "\n".join(chunks[:3])
        elif p.content:
            part += f"\nContent excerpt: {p.content[:800]}"
        parts.append(part)
    return "\n\n---\n\n".join(parts)


# ── Endpoints ──

@router.post("/generate", response_model=VisualSummaryResponse)
async def generate_visual_summary(
    body: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full pipeline: papers → summary → diagrams → PDF."""

    # Verify workspace belongs to user
    ws_result = await db.execute(
        select(Workspace).where(
            Workspace.id == body.workspace_id,
            Workspace.user_id == current_user.id,
        )
    )
    workspace = ws_result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Fetch papers
    papers_result = await db.execute(
        select(Paper).where(Paper.workspace_id == body.workspace_id)
    )
    papers = papers_result.scalars().all()
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in this workspace")

    # Retrieve vector chunks for richer context
    paper_ids = [p.id for p in papers if p.content]
    retrieved_chunks = {}
    if paper_ids:
        try:
            retrieved_chunks = vector_store.query_papers(
                paper_ids,
                "summarize key findings, methodology, architecture, and contributions",
                n_results=5,
            )
        except Exception as e:
            print(f"[VISUAL SUMMARY] Vector retrieval failed: {e}")

    papers_text = _build_paper_text(papers, retrieved_chunks)

    session_id = uuid.uuid4().hex[:12]

    # ── Agent 1: Structured Summary ──
    try:
        summary_data = generate_structured_summary(papers_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {e}")

    # ── Agent 2: Diagram Generation ──
    try:
        diagrams = generate_diagrams(
            summary=summary_data.get("structured_summary", ""),
            methodology=summary_data.get("methodology", ""),
            paper_type=summary_data.get("paper_type", "Applied Research"),
        )
    except Exception as e:
        print(f"[VISUAL SUMMARY] Diagram generation failed: {e}")
        diagrams = []

    # ── Render diagrams to PNG for PDF ──
    diagram_images: list[str | None] = []
    for i, d in enumerate(diagrams):
        img_path = os.path.join(DIAGRAMS_DIR, session_id, f"diagram_{i + 1}.png")
        success = render_diagram_to_png(d["mermaid_code"], img_path)
        diagram_images.append(img_path if success else None)

    # ── Agent 3: PDF Generation ──
    pdf_ready = False
    try:
        generate_pdf(summary_data, diagrams, diagram_images, session_id)
        pdf_ready = True
    except Exception as e:
        print(f"[VISUAL SUMMARY] PDF generation failed: {e}")

    # Build response
    return VisualSummaryResponse(
        session_id=session_id,
        summary=SummarySection(
            paper_type=summary_data.get("paper_type", "Applied Research"),
            structured_summary=summary_data.get("structured_summary", ""),
            key_contributions=summary_data.get("key_contributions", []),
            methodology=summary_data.get("methodology", ""),
            results=summary_data.get("results", ""),
        ),
        diagrams=[
            DiagramOut(
                title=d["title"],
                diagram_type=d["diagram_type"],
                mermaid_code=d["mermaid_code"],
                description=d.get("description", ""),
            )
            for d in diagrams
        ],
        pdf_ready=pdf_ready,
    )


class RegenerateDiagramRequest(BaseModel):
    summary: str
    methodology: str
    paper_type: str
    diagram_index: int


@router.post("/regenerate-diagram", response_model=DiagramOut)
async def regenerate_diagram(
    body: RegenerateDiagramRequest,
    current_user: User = Depends(get_current_user),
):
    """Regenerate a single diagram by calling the LLM again."""
    try:
        result = regenerate_single_diagram(
            summary=body.summary,
            methodology=body.methodology,
            paper_type=body.paper_type,
            diagram_index=body.diagram_index,
        )
        return DiagramOut(
            title=result["title"],
            diagram_type=result["diagram_type"],
            mermaid_code=result["mermaid_code"],
            description=result.get("description", ""),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagram regeneration failed: {e}")


@router.get("/download/{session_id}")
async def download_pdf(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Download the generated academic visual summary PDF."""
    path = os.path.join(PDF_DIR, f"storyboard_{session_id}.pdf")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"research_visual_summary_{session_id}.pdf",
    )
