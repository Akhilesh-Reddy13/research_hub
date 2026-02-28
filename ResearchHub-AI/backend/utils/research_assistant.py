from utils.groq_client import get_gemini_response


class ResearchAssistant:
    def __init__(self):
        self.conversation_history = []

    def create_research_context(self, papers, query: str, retrieved_chunks: dict[int, list[str]] | None = None) -> str:
        """Build structured context from papers for the AI prompt.
        Uses vector-retrieved chunks when available, falls back to abstract."""
        context_parts = []
        for paper in papers:
            paper_context = f"""
Title: {paper.title}
Authors: {paper.authors or 'N/A'}
Abstract: {paper.abstract or 'N/A'}
"""
            # Use vector-retrieved chunks if available for this paper
            if retrieved_chunks and paper.id in retrieved_chunks:
                chunks = retrieved_chunks[paper.id]
                paper_context += "Relevant Content (from vector retrieval):\n"
                paper_context += "\n---\n".join(chunks) + "\n"
            elif paper.content:
                paper_context += f"Full Content:\n{paper.content}\n"

            context_parts.append(paper_context)

        full_context = "\n---\n".join(context_parts)
        return f"Research Papers Context:\n{full_context}\n\nUser Query: {query}"

    def generate_research_response(self, context: str, query: str) -> str:
        """Call LLM with research context and return response."""
        system_prompt = (
            "You are an expert AI Research Assistant embedded in a research workspace. "
            "Your primary job is to help researchers deeply understand the papers they have uploaded. "
            "You have access to the full text and metadata of these papers.\n\n"
            "Do NOT restate or echo the user's question. Jump straight into the answer.\n\n"
            "RESPONSE GUIDELINES:\n"
            "1. *Be specific, not generic.* Every claim you make must reference concrete details "
            "(section numbers, figure/table references, specific results) from the provided papers.\n"
            "2. *Cite equations.* When the user's question involves methodology, derivations, models, "
            "or quantitative relationships, you MUST reproduce the relevant equations from the paper "
            "using LaTeX notation (e.g., $E = mc^2$). Reference the equation number if available "
            "(e.g., \"Eq. 3 in [Author, Title]\"). If the paper defines variables, state what each "
            "variable represents.\n"
            "3. *Cite precisely.* Use the format [Author(s), Paper Title] when referencing a paper. "
            "When referencing a specific part, add section/page info: [Author, Title, §3.2].\n"
            "4. *Adapt your depth to the question.* For simple factual questions, give a concise "
            "answer with a citation. For complex analytical questions, provide a thorough breakdown.\n"
            "5. *Compare across papers* when the user asks about a concept covered by multiple papers. "
            "Highlight agreements, contradictions, and complementary perspectives.\n\n"
            "STRUCTURE (use only the sections relevant to the query — not every section is needed every time):\n\n"
            "## 📊 Key Findings\n"
            "Bullet-point the most important findings with citations and data.\n\n"
            "## 🔬 Detailed Analysis\n"
            "In-depth synthesis. Include equations (LaTeX), methodology details, and variable definitions "
            "from the papers. Use sub-headings for clarity.\n\n"
            "## 📐 Relevant Equations\n"
            "If the query involves any quantitative or mathematical content, list all relevant equations "
            "from the papers here. For each equation:\n"
            "- Write it in LaTeX: $...$\n"
            "- State the equation number and source: (Eq. X, [Author, Title])\n"
            "- Briefly explain what the equation represents and define key variables.\n"
            "If no equations are relevant, omit this section entirely.\n\n"
            "## 📎 Sources & Citations\n"
            "List referenced papers with title, authors, and a one-line relevance note.\n\n"
            "## 💡 Further Research Suggestions\n"
            "Suggest 2-3 follow-up questions or research directions based on the analysis.\n\n"
            "RULES:\n"
            "- Always ground your answers in the provided paper context — do not hallucinate.\n"
            "- If the context lacks relevant information, explicitly state: "
            "\"⚠️ The provided papers do not contain enough information to fully answer this query.\"\n"
            "- Prefer reproducing the paper's own notation and terminology.\n"
            "- When a paper presents a model or algorithm, describe its steps and cite the equations.\n"
            "- Never give a generic textbook answer when paper-specific content is available."
        )
        user_prompt = f"Context:\n{context}\n\nQuestion: {query}"
        return get_gemini_response(system_prompt, user_prompt)

    def summarize_paper(self, paper, retrieved_chunks: list[str] | None = None) -> str:
        """Generate a concise summary of a single paper.
        Uses vector-retrieved chunks when available for richer context."""
        prompt = (
            f"Summarize this research paper in a few paragraphs:\n\n"
            f"Title: {paper.title}\n"
            f"Authors: {paper.authors or 'N/A'}\n"
            f"Abstract: {paper.abstract or 'N/A'}"
        )
        if retrieved_chunks:
            prompt += "\n\nRelevant Content (from vector retrieval):\n"
            prompt += "\n---\n".join(retrieved_chunks)
        elif paper.content:
            prompt += f"\n\nFull Content:\n{paper.content}"
        return get_gemini_response(
            "Summarize academic papers concisely.",
            prompt,
        )

    def compare_papers(self, papers, retrieved_chunks: dict[int, list[str]] | None = None) -> str:
        """Compare multiple papers and identify similarities/differences.
        Uses vector-retrieved chunks when available for deeper comparison."""
        descriptions = []
        for p in papers:
            desc = f"- Title: {p.title}\n  Authors: {p.authors or 'N/A'}\n  Abstract: {p.abstract or 'N/A'}"
            if retrieved_chunks and p.id in retrieved_chunks:
                chunks = retrieved_chunks[p.id]
                desc += "\n  Relevant Content:\n  " + "\n  ".join(chunks)
            elif p.content:
                desc += f"\n  Full Content:\n  {p.content}"
            descriptions.append(desc)
        prompt = (
            "Compare and contrast the following research papers. "
            "Identify key similarities, differences, methodologies, and findings:\n\n"
            + "\n\n".join(descriptions)
        )
        return get_gemini_response(
            "You are an expert at comparative analysis of academic papers.",
            prompt,
        )

    def extract_key_findings(self, papers, retrieved_chunks: dict[int, list[str]] | None = None) -> str:
        """Extract key findings across multiple papers.
        Uses vector-retrieved chunks when available for deeper analysis."""
        descriptions = []
        for p in papers:
            desc = f"- Title: {p.title}\n  Abstract: {p.abstract or 'N/A'}"
            if retrieved_chunks and p.id in retrieved_chunks:
                chunks = retrieved_chunks[p.id]
                desc += "\n  Relevant Content:\n  " + "\n  ".join(chunks)
            elif p.content:
                desc += f"\n  Full Content:\n  {p.content}"
            descriptions.append(desc)
        prompt = (
            "Extract and list the key findings from these research papers:\n\n"
            + "\n\n".join(descriptions)
        )
        return get_gemini_response(
            "You are an expert at extracting key findings from academic research.",
            prompt,
        )
