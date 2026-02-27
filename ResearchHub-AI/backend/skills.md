# Backend Skills — ResearchHub AI

## Purpose

This file provides complete context for any AI agent or developer to build, modify, or extend the ResearchHub AI backend. Read this file before making any backend changes. For full project context, also read `../../plan.md`.

---

## Tech Stack

- **Framework**: FastAPI 0.104.1
- **Language**: Python 3.10+
- **AI Model**: Google Gemini 2.0 Flash via `google-generativeai` SDK
- **Database**: SQLite (dev) via SQLAlchemy 2.0 async + aiosqlite
- **Auth**: JWT via python-jose (HS256), bcrypt via passlib
- **HTTP Client**: httpx (for external academic API calls)
- **Embeddings**: sentence-transformers (all-MiniLM-L6-v2)
- **PDF Parsing**: PyPDF2
- **Academic API**: OpenAlex (free, no key required)

---

## Backend Structure

```
backend/
├── main.py                    # App entry point, CORS, router includes, DB init on startup
├── requirements.txt           # Python dependencies
├── .env                       # Environment variables (DO NOT COMMIT)
├── skills.md                  # THIS FILE
├── models/
│   ├── __init__.py            # Exports all models
│   ├── user.py                # User model
│   ├── paper.py               # Paper model
│   ├── workspace.py           # Workspace model
│   └── conversation.py        # Conversation model
├── routers/
│   ├── __init__.py
│   ├── auth.py                # Auth endpoints (register, login)
│   ├── papers.py              # Paper search/import/upload/delete endpoints
│   ├── chat.py                # AI chat + conversation history endpoints
│   └── workspaces.py          # Workspace CRUD endpoints
└── utils/
    ├── __init__.py
    ├── gemini_client.py       # Gemini SDK configuration + helper
    ├── research_assistant.py  # AI analysis logic (context building, summarize, compare)
    ├── database.py            # DB engine, async session, Base, init_db
    └── auth_utils.py          # JWT + password utilities + get_current_user dependency
```

---

## Dependencies (requirements.txt)

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-dotenv==1.0.0
google-generativeai>=0.8.0
httpx==0.25.2
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
sqlalchemy==2.0.23
aiosqlite==0.19.0
numpy==1.24.3
sentence-transformers==2.2.2
PyPDF2==3.0.1
```

---

## Environment Variables (.env)

```
GEMINI_API_KEY=your_google_ai_api_key_here
SECRET_KEY=your_jwt_secret_key_here
DATABASE_URL=sqlite+aiosqlite:///./researchhub.db
```

- `GEMINI_API_KEY`: Obtain from https://aistudio.google.com/ → Create API Key
- `SECRET_KEY`: Random string for JWT signing. Generate with `openssl rand -hex 32`
- `DATABASE_URL`: SQLite for dev. For prod, use `postgresql+asyncpg://user:pass@host/db`

---

## Conventions & Patterns

### Async Everything
All endpoint handlers and DB operations MUST be `async def`. Use `await` for DB queries and external HTTP calls via httpx.

### Dependency Injection
- Use `Depends(get_db)` for database sessions in every endpoint that touches the DB.
- Use `Depends(get_current_user)` for ALL protected endpoints.
- `get_current_user` extracts the JWT from the `Authorization: Bearer <token>` header, decodes it, queries the user from DB, and returns the User object. Raises HTTP 401 if invalid.

### Request/Response Models (Pydantic)
Use Pydantic `BaseModel` classes for all request bodies and responses:

```python
from pydantic import BaseModel
from typing import Optional, List

class UserCreate(BaseModel):
    email: str
    username: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class PaperImport(BaseModel):
    title: str
    authors: str
    abstract: str
    url: str
    doi: Optional[str] = None
    published_date: Optional[str] = None
    workspace_id: int

class ChatMessage(BaseModel):
    message: str
    workspace_id: int

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
```

### Error Handling
- Use `HTTPException` with appropriate status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error).
- Always validate that resources belong to the current user before returning or modifying.
- Wrap external API calls (httpx, Gemini) in try/except and return meaningful error messages.

### CORS
Configured in `main.py` to allow `http://localhost:5173` (Vite dev server). Add production domain when deploying.

---

## File-by-File Implementation Guide

### `utils/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./researchhub.db")

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

---

### `utils/gemini_client.py`

```python
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

DEFAULT_GENERATION_CONFIG = genai.GenerationConfig(
    temperature=0.3,
    max_output_tokens=2000,
    top_p=0.9
)

def get_gemini_response(system_prompt, user_prompt):
    """Call Gemini with a system instruction and user prompt. Returns text string."""
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system_prompt
    )
    response = model.generate_content(
        user_prompt,
        generation_config=DEFAULT_GENERATION_CONFIG
    )
    return response.text
```

**Critical Gemini differences from Groq/OpenAI**:
| Aspect | Groq/OpenAI | Gemini |
|--------|-------------|--------|
| API call | `client.chat.completions.create(messages=[...])` | `model.generate_content(prompt)` |
| System prompt | `{"role": "system", "content": "..."}` in messages array | `system_instruction` param on `GenerativeModel()` |
| Response text | `response.choices[0].message.content` | `response.text` |
| Max tokens param | `max_tokens` | `max_output_tokens` |
| Model name | `llama-3.3-70b-versatile` | `gemini-2.0-flash` |

---

### `utils/auth_utils.py`

```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from utils.database import get_db
import os

SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    from models.user import User
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user
```

---

### `models/user.py`

```python
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from utils.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
```

### `models/workspace.py`

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from utils.database import Base

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
```

### `models/paper.py`

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from utils.database import Base

class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    authors = Column(String, nullable=True)           # Comma-separated string
    abstract = Column(Text, nullable=True)
    url = Column(String, nullable=True)
    doi = Column(String, nullable=True)
    published_date = Column(String, nullable=True)
    content = Column(Text, nullable=True)              # Full text from uploaded PDFs
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    imported_at = Column(DateTime, server_default=func.now())
```

### `models/conversation.py`

```python
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from utils.database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_message = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
```

### `models/__init__.py`

```python
from models.user import User
from models.paper import Paper
from models.workspace import Workspace
from models.conversation import Conversation
```

---

### `routers/auth.py`

- **Prefix**: `/api/auth`
- **Endpoints**:

**`POST /register`**:
- Accept `UserCreate` body
- Check email not already taken (query DB)
- Hash password with `hash_password()`
- Create User, add to DB, commit
- Return `{"message": "User registered successfully"}`

**`POST /login`**:
- Accept `UserLogin` body
- Find user by email in DB
- Verify password with `verify_password()`
- If invalid → raise 401
- Create JWT with `create_access_token({"sub": user.email})`
- Return `{"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "username": user.username}}`

---

### `routers/workspaces.py`

- **Prefix**: `/api/workspaces`
- All endpoints require `current_user = Depends(get_current_user)`

**`POST /`** — Create workspace. Accept `WorkspaceCreate`. Insert Workspace with `user_id=current_user.id`. Return workspace.

**`GET /`** — List all workspaces for current user. Include paper count per workspace (subquery or separate count query).

**`GET /{id}`** — Get single workspace. Verify `workspace.user_id == current_user.id`. Return workspace details.

**`PUT /{id}`** — Update workspace name/description. Verify ownership.

**`DELETE /{id}`** — Delete workspace. Also delete associated papers and conversations. Verify ownership.

---

### `routers/papers.py`

- **Prefix**: `/api/papers`
- All endpoints require `current_user = Depends(get_current_user)`

**`GET /search?query=str`**:
- Use httpx async client to query OpenAlex:
  ```python
  async with httpx.AsyncClient() as http_client:
      resp = await http_client.get(
          "https://api.openalex.org/works",
          params={"search": query, "per_page": 20}
      )
  data = resp.json()
  ```
- Parse `data["results"]` → extract for each work:
  - `title`
  - `authors`: join `authorships[].author.display_name` with ", "
  - `abstract`: reconstruct from `abstract_inverted_index` (see helper below)
  - `doi`
  - `url`: from `primary_location.landing_page_url` or DOI
  - `published_date`: from `publication_date`
- Return `{"papers": [...]}`

**Abstract reconstruction helper**:
```python
def reconstruct_abstract(inverted_index):
    if not inverted_index:
        return ""
    words = {}
    for word, positions in inverted_index.items():
        for pos in positions:
            words[pos] = word
    return " ".join(words[i] for i in sorted(words.keys()))
```

**`POST /import`**:
- Accept `PaperImport` body
- Verify workspace belongs to current user
- Create Paper record with all fields + `user_id=current_user.id`
- Return `{"message": "Paper imported successfully", "paper": {...}}`

**`POST /upload`**:
- Accept `UploadFile` (PDF) + `workspace_id` (form field)
- Read PDF with PyPDF2, extract text from all pages
- Create Paper with `title` from filename (or first line), `content` from extracted text
- Return paper data

**`GET /workspace/{workspace_id}`**:
- Verify workspace belongs to current user
- Query papers where workspace_id matches
- Return list of papers

**`DELETE /{paper_id}`**:
- Verify paper belongs to current user
- Delete from DB

---

### `routers/chat.py`

- **Prefix**: `/api/chat`
- All endpoints require `current_user = Depends(get_current_user)`

**`POST /`**:
- Accept `ChatMessage` body `{message, workspace_id}`
- Verify workspace belongs to current user
- Fetch all papers for that workspace
- Instantiate `ResearchAssistant`, call `create_research_context(papers, message)`
- Call `get_gemini_response(system_prompt, context_prompt)`
- Store Conversation record (user_message, ai_response, workspace_id, user_id)
- Return `{"response": ai_text}`

**`GET /history/{workspace_id}`**:
- Verify workspace belongs to current user
- Query Conversations ordered by `created_at` ascending
- Return list of `{user_message, ai_response, created_at}`

---

### `utils/research_assistant.py`

```python
from utils.gemini_client import get_gemini_response

class ResearchAssistant:
    def __init__(self):
        self.conversation_history = []

    def create_research_context(self, papers, query):
        """Build structured context from papers for the AI prompt."""
        context_parts = []
        for paper in papers:
            paper_context = f"""
Title: {paper.title}
Authors: {paper.authors}
Abstract: {paper.abstract}
"""
            if paper.content:
                paper_context += f"Content (excerpt): {paper.content[:2000]}\n"
            context_parts.append(paper_context)

        full_context = "\n---\n".join(context_parts)
        return f"Research Papers Context:\n{full_context}\n\nUser Query: {query}"

    def generate_research_response(self, context, query):
        """Call Gemini with research context and return response."""
        system_prompt = (
            "You are an expert research assistant specializing in analyzing academic papers. "
            "Use the provided paper context to give accurate, well-reasoned answers. "
            "Cite specific papers when possible."
        )
        user_prompt = f"Context:\n{context}\n\nQuestion: {query}"
        return get_gemini_response(system_prompt, user_prompt)

    def summarize_paper(self, paper):
        """Generate a concise summary of a single paper."""
        prompt = f"Provide a comprehensive summary of this research paper:\n\nTitle: {paper.title}\nAuthors: {paper.authors}\nAbstract: {paper.abstract}"
        if paper.content:
            prompt += f"\n\nFull Text (excerpt): {paper.content[:3000]}"
        return get_gemini_response("You are an expert at summarizing academic papers.", prompt)

    def compare_papers(self, papers):
        """Compare multiple papers and identify similarities/differences."""
        descriptions = []
        for p in papers:
            descriptions.append(f"- Title: {p.title}\n  Authors: {p.authors}\n  Abstract: {p.abstract[:500]}")
        prompt = "Compare and contrast the following research papers. Identify key similarities, differences, methodologies, and findings:\n\n" + "\n\n".join(descriptions)
        return get_gemini_response("You are an expert at comparative analysis of academic papers.", prompt)

    def extract_key_findings(self, papers):
        """Extract key findings across multiple papers."""
        descriptions = []
        for p in papers:
            descriptions.append(f"- Title: {p.title}\n  Abstract: {p.abstract}")
        prompt = "Extract and list the key findings from these research papers:\n\n" + "\n\n".join(descriptions)
        return get_gemini_response("You are an expert at extracting key findings from academic research.", prompt)
```

---

### `main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from utils.database import init_db
from routers import auth, papers, workspaces, chat

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="ResearchHub AI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(papers.router, prefix="/api/papers", tags=["Papers"])
app.include_router(workspaces.router, prefix="/api/workspaces", tags=["Workspaces"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

@app.get("/")
async def root():
    return {"message": "ResearchHub AI API is running"}
```

---

## Running the Backend

```bash
cd ResearchHub-AI/backend
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API docs (Swagger): http://localhost:8000/docs
- Alternative docs (ReDoc): http://localhost:8000/redoc
- Health check: http://localhost:8000/

---

## Implementation Order

Follow this sequence for clean dependency resolution:

1. `utils/database.py`
2. `models/user.py` → `models/workspace.py` → `models/paper.py` → `models/conversation.py` → `models/__init__.py`
3. `utils/auth_utils.py`
4. `utils/gemini_client.py`
5. `routers/auth.py`
6. `routers/workspaces.py`
7. `routers/papers.py`
8. `utils/research_assistant.py`
9. `routers/chat.py`
10. `main.py`

---

## Testing Checklist

- [ ] `POST /api/auth/register` — creates user, returns success
- [ ] `POST /api/auth/register` — rejects duplicate email
- [ ] `POST /api/auth/login` — returns JWT for valid credentials
- [ ] `POST /api/auth/login` — rejects invalid credentials
- [ ] `POST /api/workspaces` — creates workspace for authenticated user
- [ ] `GET /api/workspaces` — lists only current user's workspaces
- [ ] `GET /api/papers/search?query=machine+learning` — returns papers from OpenAlex
- [ ] `POST /api/papers/import` — imports paper to workspace
- [ ] `POST /api/papers/upload` — uploads PDF and extracts text
- [ ] `POST /api/chat` — returns Gemini-powered AI response with paper context
- [ ] `GET /api/chat/history/{workspace_id}` — returns conversation history
- [ ] All protected endpoints reject requests without valid JWT
