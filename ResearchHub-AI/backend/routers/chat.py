from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from utils.database import get_db
from utils.auth_utils import get_current_user
from utils.research_assistant import ResearchAssistant
from utils.groq_client import QuotaExceededError, get_groq_browser_search_response
from utils import vector_store
from models.user import User
from models.workspace import Workspace
from models.paper import Paper
from models.conversation import Conversation

router = APIRouter()


# ---------- Pydantic schemas ----------

class ChatMessage(BaseModel):
    message: str
    workspace_id: int
    paper_ids: list[int] | None = None  # When set, only these papers are used as context
    web_search: bool = False  # When True, use Groq browser_search instead of paper context


class ToolRequest(BaseModel):
    tool: str  # "summarize", "compare", "findings"
    paper_ids: list[int]
    workspace_id: int


# ---------- Endpoints ----------

@router.post("")
async def chat(
    body: ChatMessage,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    # --- Deep Research Mode: use Groq browser_search ---
    if body.web_search:
        try:
            ai_text = get_groq_browser_search_response(body.message)
        except QuotaExceededError as e:
            raise HTTPException(status_code=429, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Web search failed: {str(e)}")

        # Store conversation
        conversation = Conversation(
            workspace_id=body.workspace_id,
            user_id=current_user.id,
            user_message=body.message,
            ai_response=ai_text,
            is_web_search=True,
        )
        db.add(conversation)
        await db.flush()

        return {"response": ai_text, "is_web_search": True}

    # --- Standard Mode: paper-context RAG with Llama 3.3 70B ---
    # Fetch papers — only selected ones if paper_ids provided, else all in workspace
    if body.paper_ids:
        papers_result = await db.execute(
            select(Paper).where(
                Paper.id.in_(body.paper_ids),
                Paper.workspace_id == body.workspace_id,
            )
        )
    else:
        papers_result = await db.execute(
            select(Paper).where(Paper.workspace_id == body.workspace_id)
        )
    papers = papers_result.scalars().all()

    # Retrieve relevant chunks from vector store for papers that have embeddings
    paper_ids_with_content = [p.id for p in papers if p.content]
    retrieved_chunks = {}
    if paper_ids_with_content:
        try:
            retrieved_chunks = vector_store.query_papers(
                paper_ids_with_content, body.message, n_results=5
            )
        except Exception as e:
            print(f"[WARNING] Vector retrieval failed: {e}")

    # Build context and generate response
    assistant = ResearchAssistant()
    context = assistant.create_research_context(papers, body.message, retrieved_chunks)

    try:
        ai_text = assistant.generate_research_response(context, body.message)
    except QuotaExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Store conversation
    conversation = Conversation(
        workspace_id=body.workspace_id,
        user_id=current_user.id,
        user_message=body.message,
        ai_response=ai_text,
        is_web_search=False,
    )
    db.add(conversation)
    await db.flush()

    return {"response": ai_text, "is_web_search": False}


@router.get("/history/{workspace_id}")
async def get_chat_history(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify workspace belongs to user
    ws_result = await db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
    )
    workspace = ws_result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.workspace_id == workspace_id,
            Conversation.user_id == current_user.id,
        )
        .order_by(Conversation.created_at.asc())
    )
    conversations = result.scalars().all()

    return {
        "history": [
            {
                "id": c.id,
                "user_message": c.user_message,
                "ai_response": c.ai_response,
                "is_web_search": c.is_web_search or False,
                "created_at": str(c.created_at),
            }
            for c in conversations
        ]
    }


@router.post("/tool")
async def run_ai_tool(
    body: ToolRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run a specific AI tool on selected papers only — uses minimal context."""
    # Verify workspace
    ws_result = await db.execute(
        select(Workspace).where(
            Workspace.id == body.workspace_id,
            Workspace.user_id == current_user.id,
        )
    )
    if not ws_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Fetch ONLY the selected papers
    papers_result = await db.execute(
        select(Paper).where(
            Paper.id.in_(body.paper_ids),
            Paper.workspace_id == body.workspace_id,
        )
    )
    papers = papers_result.scalars().all()
    if not papers:
        raise HTTPException(status_code=404, detail="No papers found")

    # Retrieve relevant chunks from vector store for papers with content
    paper_ids_with_content = [p.id for p in papers if p.content]
    retrieved_chunks = {}
    if paper_ids_with_content:
        try:
            # Use tool name as query context for better retrieval
            query_hint = {
                "summarize": f"summarize the key points and contributions of this paper",
                "compare": "compare methodologies, findings, similarities and differences",
                "findings": "key findings, results, conclusions, contributions",
            }.get(body.tool, body.tool)
            retrieved_chunks = vector_store.query_papers(
                paper_ids_with_content, query_hint, n_results=20
            )
        except Exception as e:
            print(f"[WARNING] Vector retrieval failed: {e}")

    assistant = ResearchAssistant()
    try:
        if body.tool == "summarize":
            chunks_for_paper = retrieved_chunks.get(papers[0].id)
            ai_text = assistant.summarize_paper(papers[0], chunks_for_paper)
        elif body.tool == "compare":
            if len(papers) < 2:
                raise HTTPException(status_code=400, detail="Need at least 2 papers to compare")
            ai_text = assistant.compare_papers(papers, retrieved_chunks)
        elif body.tool == "findings":
            ai_text = assistant.extract_key_findings(papers, retrieved_chunks)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown tool: {body.tool}")
    except QuotaExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI tool failed: {str(e)}")

    return {"response": ai_text}
