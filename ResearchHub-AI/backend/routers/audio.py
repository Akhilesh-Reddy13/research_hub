"""
Audio Router
--------------
Generates MP3 narration from a workspace's existing summary.

The summary is retrieved from internal sources (conversation history
or the visual summary pipeline) — the user does NOT send any text.

Endpoint:
    POST /api/audio/generate/{workspace_id}
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from utils.database import get_db
from utils.auth_utils import get_current_user
from utils.audio_generator import generate_audio
from models.user import User
from models.workspace import Workspace
from models.paper import Paper
from models.conversation import Conversation

router = APIRouter()


class AudioResponse(BaseModel):
    audio_url: str
    message: str


async def _get_workspace_summary(db: AsyncSession, workspace_id: int, user_id: int) -> str | None:
    """Try to retrieve the best available summary for a workspace.

    Strategy (in priority order):
      1. Latest AI response from a 'summarize' tool call in conversations
      2. Latest AI response from any conversation in the workspace
      3. Build a quick summary from paper abstracts
    """

    # 1. Look for a summary-style conversation (summarize tool or summary keyword)
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.workspace_id == workspace_id,
            Conversation.user_id == user_id,
        )
        .order_by(desc(Conversation.created_at))
        .limit(20)
    )
    conversations = result.scalars().all()

    # Prefer responses to "summarize" requests
    for c in conversations:
        msg_lower = c.user_message.lower()
        if any(kw in msg_lower for kw in ["summarize", "summary", "key findings", "overview"]):
            if len(c.ai_response) > 100:
                return c.ai_response

    # 2. Fall back to latest substantial AI response
    for c in conversations:
        if len(c.ai_response) > 200:
            return c.ai_response

    # 3. Build from paper abstracts
    papers_result = await db.execute(
        select(Paper).where(Paper.workspace_id == workspace_id)
    )
    papers = papers_result.scalars().all()

    if papers:
        abstracts = []
        for p in papers:
            if p.abstract:
                abstracts.append(f"{p.title}: {p.abstract}")
            elif p.content:
                abstracts.append(f"{p.title}: {p.content[:500]}")
        if abstracts:
            return "Research Summary.\n\n" + "\n\n".join(abstracts[:5])

    return None


@router.post("/generate/{workspace_id}", response_model=AudioResponse)
async def generate_audio_summary(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate an MP3 audio narration from the workspace's existing summary."""

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

    # Retrieve summary from internal sources
    summary = await _get_workspace_summary(db, workspace_id, current_user.id)
    if not summary:
        raise HTTPException(
            status_code=400,
            detail="No summary available for this workspace. "
                   "Please chat with your papers or run the Summarize tool first.",
        )

    # Generate audio
    try:
        audio_url = await generate_audio(summary, workspace_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

    return AudioResponse(
        audio_url=audio_url,
        message="Audio summary generated successfully",
    )
