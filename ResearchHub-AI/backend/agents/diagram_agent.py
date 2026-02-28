"""
Agent 2: Diagram Agent (Mermaid Diagram Generation)
------------------------------------------------------
Uses LangChain (ChatGroq + ChatPromptTemplate) to generate
Mermaid diagram code for each paper type.

Diagram types generated per paper:
  1. System Architecture
  2. Methodology Flowchart
  3. Model / Research Pipeline
  4. Data Flow Diagram

For PDF embedding, renders diagrams via mermaid.ink API.
"""

import os
import re
import base64
import httpx
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

_groq_api_key = os.getenv("GROQ_API_KEY", "")

_llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=_groq_api_key,
    temperature=0.2,
    max_tokens=1500,
) if _groq_api_key else None

DIAGRAMS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "generated_diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# ── Diagram configurations per paper type ──

DIAGRAM_CONFIGS = {
    "default": [
        {
            "title": "System Architecture",
            "diagram_type": "architecture",
            "instruction": (
                "Create a Mermaid graph TD (top-down) diagram showing the overall system architecture. "
                "Include main components, their connections, and data flow between them. "
                "Use clear labels and subgraphs to group related components."
            ),
        },
        {
            "title": "Methodology Flowchart",
            "diagram_type": "flowchart",
            "instruction": (
                "Create a Mermaid flowchart TD showing the research methodology step by step. "
                "Include decision points, processes, and outcomes. "
                "Use diamond shapes for decisions and rectangles for processes."
            ),
        },
        {
            "title": "Research Pipeline",
            "diagram_type": "pipeline",
            "instruction": (
                "Create a Mermaid graph LR (left-to-right) diagram showing the complete research pipeline. "
                "From data input through processing stages to final output/results. "
                "Use clear arrows showing data transformation at each stage."
            ),
        },
        {
            "title": "Data Flow Diagram",
            "diagram_type": "dataflow",
            "instruction": (
                "Create a Mermaid graph TD diagram showing how data flows through the system. "
                "Include data sources, transformations, storage, and outputs. "
                "Use appropriate shapes for different element types."
            ),
        },
    ],
}

# ── LangChain chain for diagram generation ──

_diagram_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a technical diagram expert who creates Mermaid.js diagrams for academic papers.\n\n"
     "STRICT SYNTAX RULES:\n"
     "1. Output ONLY valid Mermaid diagram code — no explanation, no markdown fences\n"
     "2. Start with the graph/flowchart declaration (e.g., graph TD, flowchart LR)\n"
     "3. Use clear, concise labels (max 4-5 words per node)\n"
     "4. Keep diagrams focused — 8-15 nodes maximum\n"
     "5. Each connection MUST be on ONE line: A[Label] --> B[Label] — NEVER split across lines\n"
     "6. Arrow types allowed: -->, -.->  with optional labels: -->|label|\n"
     "7. Node IDs must be simple: A, B, proc1, inp, out — NEVER start with 'subgraph', 'end', or 'graph'\n"
     "8. Wrap node labels in square brackets: A[Label]\n"
     "9. For subgraph titles with spaces use: subgraph MyId[\"Display Title\"]\n"
     "10. Do NOT use special characters inside node labels (no quotes, parens, ampersands)\n"
     "11. NEVER put |> after edge labels. Correct: -->|label| B  Wrong: -->|label|> B\n"
     "12. End every subgraph with 'end' on its own line\n\n"
     "Paper type: {paper_type}"
     ),
    ("human",
     "Create a {diagram_type} diagram based on this research content.\n\n"
     "Diagram instruction: {instruction}\n\n"
     "Research summary:\n{summary}\n\n"
     "Methodology details:\n{methodology}\n\n"
     "Output ONLY the Mermaid code, nothing else."
     ),
])

_diagram_chain = (_diagram_prompt | _llm | StrOutputParser()) if _llm else None


def _clean_mermaid(raw: str) -> str:
    """Clean and validate Mermaid code from LLM output."""
    # Strip markdown code fences
    cleaned = re.sub(r"^```(?:mermaid)?\s*", "", raw.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()

    # Ensure it starts with a valid Mermaid declaration
    valid_starts = ["graph ", "flowchart ", "sequenceDiagram", "classDiagram",
                    "stateDiagram", "erDiagram", "gantt", "pie", "gitgraph"]
    has_valid_start = any(cleaned.lower().startswith(s.lower()) for s in valid_starts)

    if not has_valid_start:
        for s in valid_starts:
            idx = cleaned.lower().find(s.lower())
            if idx != -1:
                cleaned = cleaned[idx:]
                break
        else:
            cleaned = "graph TD\n    A[Start] --> B[Process] --> C[End]"

    # ═══════════════════════════════════════════════
    # Fix common LLM Mermaid syntax errors
    # ═══════════════════════════════════════════════

    # 1. Fix "|>" after edge labels:  -->|label|> B  →  -->|label| B
    cleaned = re.sub(r"\|(\s*)>", r"|\1", cleaned)

    # 2. Fix "|label|-->" double arrow
    cleaned = re.sub(r"\|\s*-+>", "| -->", cleaned)

    # 3. Remove HTML <br> tags
    cleaned = re.sub(r"<br\s*/?>", " ", cleaned, flags=re.IGNORECASE)

    # 4. Join orphaned arrows back to previous line
    #    e.g. "input[Data Input]\n    --> processing1[...]"  →  single line
    #    Only join if the next non-space content is an arrow, not a keyword
    lines = cleaned.split("\n")
    merged = [lines[0]] if lines else []
    for i in range(1, len(lines)):
        stripped = lines[i].strip()
        # Check if line starts with an arrow (orphaned connection)
        if re.match(r"^(--|==|-\.|\.-)(-?)>", stripped):
            merged[-1] = merged[-1].rstrip() + " " + stripped
        else:
            merged.append(lines[i])
    cleaned = "\n".join(merged)

    # 5. Fix node IDs starting with reserved keywords
    #    subgraph1 → sg_1, end1 → nd_1  (but not the keyword "subgraph" itself)
    cleaned = re.sub(r"\bsubgraph(\d+)", r"sg_\1", cleaned)
    cleaned = re.sub(r"\bend(\d+)", r"nd_\1", cleaned)

    # 6. Fix subgraph names with unquoted spaces (2-4 words only)
    #    subgraph Agent Reports → subgraph Agent_Reports["Agent Reports"]
    def _fix_subgraph_name(m):
        prefix = m.group(1)  # "    subgraph "
        name = m.group(2)    # "Agent Reports"
        if "[" in name:
            return m.group(0)
        safe_id = re.sub(r"\s+", "_", name)
        return f'{prefix}{safe_id}["{name}"]'

    # Match "subgraph" followed by 2-4 words on the SAME line (use [ \t] not \s to avoid newline)
    cleaned = re.sub(
        r"^(\s*subgraph\s+)([A-Za-z]\w*(?:[ \t]+[A-Za-z]\w*){1,3})[ \t]*$",
        _fix_subgraph_name,
        cleaned,
        flags=re.MULTILINE,
    )

    # 7. Collapse excessive blank lines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    # 8. Remove trailing LLM explanations
    lines = cleaned.split("\n")
    filtered = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("This diagram") or stripped.startswith("Note:") or stripped.startswith("The above"):
            break
        filtered.append(line)
    cleaned = "\n".join(filtered).rstrip()

    return cleaned


def generate_diagrams(summary: str, methodology: str, paper_type: str) -> list[dict]:
    """Generate 4 Mermaid diagrams for the given research content.

    Args:
        summary: The structured summary text
        methodology: The methodology text
        paper_type: Classification (e.g., 'Deep Learning Architecture')

    Returns:
        List of dicts with keys: title, diagram_type, mermaid_code, description
    """
    if _diagram_chain is None:
        raise RuntimeError("GROQ_API_KEY not configured")

    configs = DIAGRAM_CONFIGS.get(paper_type, DIAGRAM_CONFIGS["default"])
    diagrams = []

    for config in configs:
        try:
            raw = _diagram_chain.invoke({
                "paper_type": paper_type,
                "diagram_type": config["title"],
                "instruction": config["instruction"],
                "summary": summary[:2000],
                "methodology": methodology[:1500],
            })

            mermaid_code = _clean_mermaid(raw)

            diagrams.append({
                "title": config["title"],
                "diagram_type": config["diagram_type"],
                "mermaid_code": mermaid_code,
                "description": config["instruction"],
            })
            print(f"[DIAGRAM AGENT] Generated: {config['title']} ({len(mermaid_code)} chars)")

        except Exception as e:
            print(f"[DIAGRAM AGENT] Failed to generate {config['title']}: {e}")
            # Add a placeholder diagram
            diagrams.append({
                "title": config["title"],
                "diagram_type": config["diagram_type"],
                "mermaid_code": f"graph TD\n    A[{config['title']}] --> B[See paper for details]",
                "description": f"Placeholder — generation failed: {e}",
            })

    return diagrams


def regenerate_single_diagram(summary: str, methodology: str, paper_type: str, diagram_index: int) -> dict:
    """Regenerate a single diagram by index (0-3).

    Returns:
        Dict with keys: title, diagram_type, mermaid_code, description
    """
    if _diagram_chain is None:
        raise RuntimeError("GROQ_API_KEY not configured")

    configs = DIAGRAM_CONFIGS.get(paper_type, DIAGRAM_CONFIGS["default"])
    if diagram_index < 0 or diagram_index >= len(configs):
        raise ValueError(f"Invalid diagram_index {diagram_index}, must be 0-{len(configs)-1}")

    config = configs[diagram_index]
    raw = _diagram_chain.invoke({
        "paper_type": paper_type,
        "diagram_type": config["title"],
        "instruction": config["instruction"],
        "summary": summary[:2000],
        "methodology": methodology[:1500],
    })

    mermaid_code = _clean_mermaid(raw)
    print(f"[DIAGRAM AGENT] Regenerated: {config['title']} ({len(mermaid_code)} chars)")

    return {
        "title": config["title"],
        "diagram_type": config["diagram_type"],
        "mermaid_code": mermaid_code,
        "description": config["instruction"],
    }


def render_diagram_to_png(mermaid_code: str, output_path: str) -> bool:
    """Render a Mermaid diagram to PNG using mermaid.ink API.

    Args:
        mermaid_code: Valid Mermaid diagram code
        output_path: Path to save the PNG file

    Returns:
        True if successful, False otherwise
    """
    try:
        encoded = base64.urlsafe_b64encode(mermaid_code.encode("utf-8")).decode("utf-8")
        url = f"https://mermaid.ink/img/base64:{encoded}"

        response = httpx.get(url, timeout=30)
        if response.status_code == 200 and len(response.content) > 100:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(response.content)
            print(f"[DIAGRAM AGENT] Rendered PNG: {output_path}")
            return True
        else:
            print(f"[DIAGRAM AGENT] mermaid.ink returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"[DIAGRAM AGENT] PNG render failed: {e}")
        return False
