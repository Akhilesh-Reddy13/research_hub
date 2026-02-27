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
            "You are an expert research assistant specializing in analyzing academic papers. "
            "Use the provided paper context to give accurate, well-reasoned answers. "
            "Cite specific papers when possible. If the context does not contain relevant "
            "information, say so honestly."
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
