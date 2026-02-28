"""
Audio Generator Utility
--------------------------
Uses the LLM to convert a raw summary into a polished ~1.5 minute narration
script, then generates MP3 audio via edge-tts (Microsoft Edge TTS).

Usage:
    from utils.audio_generator import generate_audio
    filepath = await generate_audio(summary_text, workspace_id)
"""

import os
import re
import uuid
import edge_tts

from utils.groq_client import get_gemini_response

MEDIA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "media")
os.makedirs(MEDIA_DIR, exist_ok=True)

# Microsoft Edge TTS voice — clear, natural-sounding English
VOICE = "en-US-AriaNeural"

# ── Narration prompt ──
_NARRATION_SYSTEM = (
    "You are a professional research podcast narrator. "
    "Your job is to convert academic research summaries into engaging, "
    "clear spoken narration scripts.\n\n"
    "RULES:\n"
    "1. Write EXACTLY 200-250 words — this produces ~1.5 minutes of audio.\n"
    "2. Start with a brief, engaging introduction of the research topic.\n"
    "3. Cover the key findings, methodology, and why it matters.\n"
    "4. End with a concise conclusion or takeaway.\n"
    "5. Use natural, conversational language suitable for TEXT-TO-SPEECH.\n"
    "6. Do NOT use markdown, bullet points, numbered lists, headings, "
    "or any formatting — output ONLY plain flowing paragraphs.\n"
    "7. Do NOT use emojis, special characters, or symbols.\n"
    "8. Avoid abbreviations — spell them out (e.g., 'Natural Language Processing' not 'NLP').\n"
    "9. Use transition phrases between ideas: 'Furthermore', 'Interestingly', "
    "'The researchers found that', 'In terms of methodology', etc.\n"
    "10. Write in third person.\n"
    "11. Output ONLY the narration script — no meta-commentary, no notes."
)

_NARRATION_USER = (
    "Convert the following research summary into a spoken narration script "
    "of 200-250 words. Make it engaging and informative, suitable for an "
    "audio podcast summary.\n\n"
    "--- RESEARCH SUMMARY ---\n{summary}\n--- END ---\n\n"
    "Write the narration script now:"
)


def _strip_residual_formatting(text: str) -> str:
    """Remove any residual markdown or formatting the LLM might sneak in."""
    # Remove headings
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Remove bold/italic
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", text)
    # Remove links
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # Remove backticks
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Remove bullet/list markers
    text = re.sub(r"^\s*[-*•]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+[.)]\s+", "", text, flags=re.MULTILINE)
    # Remove emojis
    text = re.sub(
        r"[\U0001F300-\U0001F9FF\U00002702-\U000027B0\U0000FE00-\U0000FE0F"
        r"\U0000200D\U00002600-\U000026FF\U00002700-\U000027BF]+",
        "", text
    )
    # Collapse whitespace
    text = re.sub(r"\n{2,}", "\n\n", text)
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)
    text = re.sub(r"  +", " ", text)
    return text.strip()


def _generate_narration_script(summary: str) -> str:
    """Use LLM to produce a polished ~225-word narration from raw summary."""
    user_prompt = _NARRATION_USER.format(summary=summary[:4000])

    try:
        script = get_gemini_response(_NARRATION_SYSTEM, user_prompt)
        script = _strip_residual_formatting(script)

        # Validate length — if too short, the LLM failed; fall back
        if len(script.split()) < 80:
            raise ValueError("Narration too short")
        return script
    except Exception as e:
        print(f"[AUDIO] LLM narration failed ({e}), falling back to cleaned summary")
        return _strip_residual_formatting(summary)


async def generate_audio(summary: str, workspace_id: int | str) -> str:
    """Generate an MP3 narration from a summary.

    Pipeline:
      1. LLM converts raw summary → polished ~225-word narration script
      2. edge-tts converts narration → MP3

    Args:
        summary: The research summary text (can contain markdown).
        workspace_id: Used for organizing output files.

    Returns:
        Relative URL path to the generated MP3 (e.g. "/media/audio_ws3_abc123.mp3").
    """
    if not summary or len(summary.strip()) < 30:
        raise ValueError("Summary is too short to generate meaningful audio.")

    narration = _generate_narration_script(summary)

    print(f"[AUDIO] Narration: {len(narration.split())} words for workspace {workspace_id}")

    unique_id = uuid.uuid4().hex[:8]
    filename = f"audio_ws{workspace_id}_{unique_id}.mp3"
    filepath = os.path.join(MEDIA_DIR, filename)

    # Generate TTS
    communicate = edge_tts.Communicate(narration, VOICE)
    await communicate.save(filepath)

    return f"/media/{filename}"

