"""
ChromaDB vector store for research paper embeddings.
Stores chunked PDF content as vector embeddings for semantic retrieval.
"""

import os
import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv

load_dotenv()

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
COLLECTION_NAME = "research_papers"
CHUNK_SIZE = 500  # characters per chunk
CHUNK_OVERLAP = 50  # overlap between chunks

# Lazy-initialized globals
_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None
_embedding_fn = None


def _get_embedding_fn():
    """Get or create the sentence-transformers embedding function."""
    global _embedding_fn
    if _embedding_fn is None:
        _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
    return _embedding_fn


def init_vector_store():
    """Initialize ChromaDB persistent client and collection.
    Called lazily on first use — NOT at startup to avoid blocking the event loop."""
    global _client, _collection
    if _collection is not None:
        return  # already initialized
    print(f"[VECTOR STORE] Initializing ChromaDB at {CHROMA_PERSIST_DIR}")
    _client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    print(f"[VECTOR STORE] Loading embedding model (first call may take a moment)...")
    _collection = _client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=_get_embedding_fn(),
        metadata={"hnsw:space": "cosine"},
    )
    count = _collection.count()
    print(f"[VECTOR STORE] Collection '{COLLECTION_NAME}' ready — {count} chunks stored")


def _get_collection() -> chromadb.Collection:
    """Get the collection, initializing if needed."""
    global _collection
    if _collection is None:
        init_vector_store()
    return _collection


def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks of ~CHUNK_SIZE characters."""
    if not text or not text.strip():
        return []

    chunks = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = start + CHUNK_SIZE

        # Try to break at a sentence boundary (period, newline) near the end
        if end < text_len:
            # Look for a good break point in the last 100 chars of the chunk
            search_start = max(end - 100, start)
            last_period = text.rfind('. ', search_start, end)
            last_newline = text.rfind('\n', search_start, end)
            break_point = max(last_period, last_newline)
            if break_point > start:
                end = break_point + 1  # include the period/newline

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        # Move start forward, with overlap
        start = end - CHUNK_OVERLAP if end < text_len else text_len

    return chunks


def add_paper(paper_id: int, text: str) -> int:
    """Chunk and embed a paper's text content into ChromaDB.
    Uses upsert so re-uploads overwrite existing chunks atomically.
    Returns the number of chunks created."""
    collection = _get_collection()

    chunks = _chunk_text(text)
    if not chunks:
        print(f"[VECTOR STORE] Paper {paper_id}: no text to embed")
        return 0

    # Remove any excess old chunks beyond the new count (handles re-upload
    # where the new PDF has fewer chunks than the old one)
    try:
        existing = collection.get(where={"paper_id": paper_id})
        old_ids = set(existing["ids"])
        new_ids = {f"paper_{paper_id}_chunk_{i}" for i in range(len(chunks))}
        stale_ids = list(old_ids - new_ids)
        if stale_ids:
            collection.delete(ids=stale_ids)
    except Exception:
        pass  # no existing chunks — fine

    ids = [f"paper_{paper_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"paper_id": paper_id, "chunk_index": i} for i in range(len(chunks))]

    # ChromaDB batch limit — process in batches of 100
    batch_size = 100
    for batch_start in range(0, len(chunks), batch_size):
        batch_end = min(batch_start + batch_size, len(chunks))
        collection.upsert(
            ids=ids[batch_start:batch_end],
            documents=chunks[batch_start:batch_end],
            metadatas=metadatas[batch_start:batch_end],
        )

    print(f"[VECTOR STORE] Paper {paper_id}: embedded {len(chunks)} chunks ({len(text)} chars)")
    return len(chunks)


def query_paper(paper_id: int, query: str, n_results: int = 5) -> list[str]:
    """Retrieve the most relevant chunks for a single paper given a query.
    Returns a list of text chunks sorted by relevance."""
    collection = _get_collection()

    try:
        # Clamp n_results to available chunk count to avoid ChromaDB errors
        available = collection.count()
        if available == 0:
            return []
        safe_n = min(n_results, available)
        results = collection.query(
            query_texts=[query],
            n_results=safe_n,
            where={"paper_id": paper_id},
        )
    except Exception as e:
        print(f"[VECTOR STORE] Query failed for paper {paper_id}: {e}")
        return []

    documents = results.get("documents", [[]])[0]
    return documents


def query_papers(paper_ids: list[int], query: str, n_results: int = 5) -> dict[int, list[str]]:
    """Retrieve relevant chunks across multiple papers.
    Uses a single query with $in filter for efficiency.
    Returns a dict mapping paper_id → list of relevant chunks."""
    if not paper_ids:
        return {}

    collection = _get_collection()
    result_map: dict[int, list[str]] = {}

    try:
        total = collection.count()
        if total == 0:
            return {}
        # Single query with $in filter instead of N separate queries
        safe_n = min(n_results * len(paper_ids), total)
        results = collection.query(
            query_texts=[query],
            n_results=safe_n,
            where={"paper_id": {"$in": paper_ids}},
        )
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        for doc, meta in zip(docs, metas):
            pid = meta.get("paper_id")
            if pid is not None:
                result_map.setdefault(pid, []).append(doc)
        # Trim each paper's results to n_results
        for pid in result_map:
            result_map[pid] = result_map[pid][:n_results]
    except Exception as e:
        print(f"[VECTOR STORE] Batch query failed, falling back to per-paper: {e}")
        # Fallback: query one paper at a time
        for pid in paper_ids:
            try:
                chunk_count = collection.count()
                if chunk_count == 0:
                    continue
                safe_n = min(n_results, chunk_count)
                results = collection.query(
                    query_texts=[query],
                    n_results=safe_n,
                    where={"paper_id": pid},
                )
                docs = results.get("documents", [[]])[0]
                if docs:
                    result_map[pid] = docs
            except Exception as inner_e:
                print(f"[VECTOR STORE] Query failed for paper {pid}: {inner_e}")

    return result_map


def delete_paper(paper_id: int):
    """Remove all chunks for a paper from ChromaDB."""
    collection = _get_collection()
    try:
        # Get all chunk IDs for this paper
        existing = collection.get(
            where={"paper_id": paper_id},
        )
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
            print(f"[VECTOR STORE] Paper {paper_id}: deleted {len(existing['ids'])} chunks")
    except Exception as e:
        print(f"[VECTOR STORE] Delete failed for paper {paper_id}: {e}")


def has_embeddings(paper_id: int) -> bool:
    """Check if a paper has any stored embeddings."""
    collection = _get_collection()
    try:
        existing = collection.get(
            where={"paper_id": paper_id},
            limit=1,
        )
        return len(existing["ids"]) > 0
    except Exception:
        return False


def semantic_search_all(query: str, paper_ids: list[int], n_results: int = 50) -> dict[int, float]:
    """Run a semantic search across all given paper IDs.

    Returns a dict mapping paper_id → best cosine similarity score (0-1, higher = better).
    ChromaDB returns cosine *distance* (0-2 for cosine space); we convert to similarity.
    """
    if not paper_ids:
        return {}

    collection = _get_collection()
    try:
        total = collection.count()
        if total == 0:
            return {}

        safe_n = min(n_results, total)
        results = collection.query(
            query_texts=[query],
            n_results=safe_n,
            where={"paper_id": {"$in": paper_ids}},
            include=["metadatas", "distances"],
        )

        distances = results.get("distances", [[]])[0]
        metas = results.get("metadatas", [[]])[0]

        # Keep the best (lowest distance) per paper, convert to similarity
        best_scores: dict[int, float] = {}
        for dist, meta in zip(distances, metas):
            pid = meta.get("paper_id")
            if pid is None:
                continue
            similarity = max(0.0, 1.0 - dist)  # cosine distance → similarity
            if pid not in best_scores or similarity > best_scores[pid]:
                best_scores[pid] = similarity

        return best_scores
    except Exception as e:
        print(f"[VECTOR STORE] Semantic search failed: {e}")
        return {}

