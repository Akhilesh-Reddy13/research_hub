"""
Agent 1: Summary Agent (Structured Academic Summary)
------------------------------------------------------
Uses LangChain (ChatGroq + ChatPromptTemplate) to:
  1. Classify the paper type (Deep Learning, System Design, etc.)
  2. Generate a structured academic summary with key contributions,
     methodology breakdown, and results overview.
"""

import os
import json
import re
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

_groq_api_key = os.getenv("GROQ_API_KEY", "")

_llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=_groq_api_key,
    temperature=0.3,
    max_tokens=2048,
) if _groq_api_key else None

# ── Chain 1: Paper Type Classification ──

PAPER_TYPES = [
    "Deep Learning Architecture",
    "System Design",
    "Data Processing Framework",
    "Algorithm Proposal",
    "Experimental Study",
    "Survey / Review",
    "Applied Research",
]

_classify_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a research paper classifier. "
     "Given a summary of research papers, classify them into exactly ONE of these categories:\n"
     + "\n".join(f"- {t}" for t in PAPER_TYPES)
     + "\n\nRespond with ONLY the category name, nothing else."
     ),
    ("human", "{summary}"),
])

_classify_chain = (_classify_prompt | _llm | StrOutputParser()) if _llm else None

# ── Chain 2: Structured Academic Summary ──

_summary_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are an academic research analyst. Produce a structured academic summary "
     "of the provided research papers.\n\n"
     "Rules:\n"
     "- Be precise, technical, and faithful to the paper content\n"
     "- Do NOT invent data or statistics\n"
     "- Focus on academic clarity, NOT cinematic storytelling\n\n"
     "You MUST return a raw JSON object (no markdown fences, no ```json blocks, no extra text). "
     "The JSON must have exactly these 4 keys:\n"
     '{{\n'
     '  "structured_summary": "3-4 paragraph technical overview as a single string",\n'
     '  "key_contributions": ["contribution 1", "contribution 2", ...],\n'
     '  "methodology": "2-3 paragraphs about research methodology as a single string",\n'
     '  "results": "2-3 paragraphs about results and findings as a single string"\n'
     '}}\n\n'
     "IMPORTANT: Return ONLY the JSON. No markdown. No code fences. No explanation before or after."
     ),
    ("human",
     "Analyze the following research papers and produce the structured academic summary as a JSON object.\n\n"
     "{papers_text}"),
])

_summary_chain = (_summary_prompt | _llm | StrOutputParser()) if _llm else None


def _parse_json(raw: str) -> dict | None:
    """Robustly parse JSON from LLM output, stripping markdown fences if present."""
    text = raw.strip()

    # Strip ALL markdown code fences (```json ... ``` or ``` ... ```)
    # Handle multiline with re.DOTALL
    fence_match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?\s*```", text)
    if fence_match:
        text = fence_match.group(1).strip()

    # Also strip leftover fences at start/end
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?\s*```\s*$", "", text)
    text = text.strip()

    # Attempt 1: direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Attempt 2: find the outermost { ... } block
    depth = 0
    start_idx = None
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                start_idx = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start_idx is not None:
                try:
                    return json.loads(text[start_idx:i + 1])
                except json.JSONDecodeError:
                    pass
                start_idx = None

    # Attempt 3: greedy regex
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return None


def classify_paper(summary: str) -> str:
    """Classify the paper type using LangChain chain.
    Returns one of the PAPER_TYPES strings."""
    if _classify_chain is None:
        return "Applied Research"  # fallback

    try:
        result = _classify_chain.invoke({"summary": summary[:3000]})
        result = result.strip().strip('"').strip("'")
        # Fuzzy match to known types
        for pt in PAPER_TYPES:
            if pt.lower() in result.lower() or result.lower() in pt.lower():
                return pt
        return result if len(result) < 50 else "Applied Research"
    except Exception as e:
        print(f"[SUMMARY AGENT] Classification failed: {e}")
        return "Applied Research"


def generate_structured_summary(papers_text: str) -> dict:
    """Generate a structured academic summary using LangChain chain.

    Returns dict with keys:
        paper_type, structured_summary, key_contributions, methodology, results
    """
    if _summary_chain is None:
        raise RuntimeError("GROQ_API_KEY not configured")

    # Step 1: Classify
    paper_type = classify_paper(papers_text[:3000])
    print(f"[SUMMARY AGENT] Paper type: {paper_type}")

    # Step 2: Generate structured summary
    raw = _summary_chain.invoke({"papers_text": papers_text})
    parsed = _parse_json(raw)

    if parsed is None:
        # Retry once: re-invoke with explicit instruction
        print("[SUMMARY AGENT] JSON parse failed on first try, retrying…")
        try:
            retry_raw = _summary_chain.invoke({"papers_text": papers_text[:4000]})
            parsed = _parse_json(retry_raw)
        except Exception:
            pass

    if parsed is None:
        # Final fallback: strip any JSON-like formatting and use raw text
        print("[SUMMARY AGENT] JSON parse failed after retry, extracting text")
        # Try to salvage individual fields from the raw text
        clean = re.sub(r'```(?:json)?\s*', '', raw)
        clean = re.sub(r'```', '', clean)
        clean = re.sub(r'"structured_summary"\s*:', '', clean)
        clean = re.sub(r'"key_contributions"\s*:', '', clean)
        clean = re.sub(r'"methodology"\s*:', '', clean)
        clean = re.sub(r'"results"\s*:', '', clean)
        clean = re.sub(r'[{}\[\]]', '', clean)
        clean = clean.replace('\\"', '"').strip().strip(',').strip()

        parsed = {
            "structured_summary": clean[:2000] if clean else "Summary generation encountered a formatting issue. Please try again.",
            "key_contributions": ["Please regenerate for structured contributions"],
            "methodology": "Please regenerate for methodology details.",
            "results": "Please regenerate for results details.",
        }

    # Ensure all required keys exist
    result = {
        "paper_type": paper_type,
        "structured_summary": parsed.get("structured_summary", ""),
        "key_contributions": parsed.get("key_contributions", []),
        "methodology": parsed.get("methodology", ""),
        "results": parsed.get("results", ""),
    }

    # Ensure key_contributions is a list
    if isinstance(result["key_contributions"], str):
        result["key_contributions"] = [result["key_contributions"]]

    print(f"[SUMMARY AGENT] Generated summary with {len(result['key_contributions'])} contributions")
    return result
