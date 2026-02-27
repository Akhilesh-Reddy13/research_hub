from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import re
import threading
import traceback
from utils.database import init_db
from utils.vector_store import init_vector_store
from routers import auth, papers, workspaces, chat

# Accept any localhost origin (Vite may assign different ports each run)
ALLOWED_ORIGIN_RE = re.compile(r"^http://localhost:\d+$")


def _is_allowed_origin(origin: str) -> bool:
    return bool(origin and ALLOWED_ORIGIN_RE.match(origin))


def _preload_vector_store():
    """Pre-initialize ChromaDB + embedding model in a background thread
    so it's warm and ready before the first upload/query request."""
    try:
        init_vector_store()
    except Exception as e:
        print(f"[WARNING] Vector store pre-init failed (will retry on first use): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Start ChromaDB + model loading in background thread (non-blocking)
    thread = threading.Thread(target=_preload_vector_store, daemon=True)
    thread.start()
    yield


app = FastAPI(title="ResearchHub AI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://localhost:\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Catch-all exception handler so unhandled 500s still get CORS headers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    origin = request.headers.get("origin", "")
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
    if _is_allowed_origin(origin):
        response.headers["access-control-allow-origin"] = origin
        response.headers["access-control-allow-credentials"] = "true"
    return response

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(papers.router, prefix="/api/papers", tags=["Papers"])
app.include_router(workspaces.router, prefix="/api/workspaces", tags=["Workspaces"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])


@app.get("/")
async def root():
    return {"message": "ResearchHub AI API is running"}
