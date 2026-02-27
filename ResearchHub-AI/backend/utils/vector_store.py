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
    Returns the number of chunks created."""
    collection = _get_collection()

    chunks = _chunk_text(text)
    if not chunks:
        print(f"[VECTOR STORE] Paper {paper_id}: no text to embed")
        return 0

    # First, remove any existing chunks for this paper (in case of re-upload)
    delete_paper(paper_id)

    ids = [f"paper_{paper_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"paper_id": paper_id, "chunk_index": i} for i in range(len(chunks))]

    # ChromaDB has a batch size limit, process in batches of 100
    batch_size = 100
    for batch_start in range(0, len(chunks), batch_size):
        batch_end = min(batch_start + batch_size, len(chunks))
        collection.add(
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
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where={"paper_id": paper_id},
        )
    except Exception as e:
        print(f"[VECTOR STORE] Query failed for paper {paper_id}: {e}")
        return []

    documents = results.get("documents", [[]])[0]
    return documents


def query_papers(paper_ids: list[int], query: str, n_results: int = 5) -> dict[int, list[str]]:
    """Retrieve relevant chunks across multiple papers.
    Returns a dict mapping paper_id → list of relevant chunks."""
    collection = _get_collection()
    result_map: dict[int, list[str]] = {}

    for pid in paper_ids:
        try:
            results = collection.query(
                query_texts=[query],
                n_results=n_results,
                where={"paper_id": pid},
            )
            docs = results.get("documents", [[]])[0]
            if docs:
                result_map[pid] = docs
        except Exception as e:
            print(f"[VECTOR STORE] Query failed for paper {pid}: {e}")

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
