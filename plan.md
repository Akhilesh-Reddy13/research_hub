# ResearchHub AI — Master Implementation Plan

## Project Overview

**ResearchHub AI** is an intelligent, agentic AI-powered research paper management platform. It enables researchers to search for academic papers, import them into personal workspaces, upload PDFs, and interact with an AI chatbot that provides contextual insights, summaries, and answers based on research content.

**Original spec used Groq/Llama 3.3 70B — this project uses Google Gemini instead.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18+ (JavaScript, NOT TypeScript), Tailwind CSS, Vite |
| Backend | Python 3.10+, FastAPI 0.104.1 |
| AI Model | Google Gemini 2.0 Flash via `google-generativeai` SDK |
| Database | SQLite (dev) / PostgreSQL (prod) via SQLAlchemy 2.0 async |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| PDF Parsing | PyPDF2 |
| Academic APIs | OpenAlex (free, no API key required) |
| HTTP Client | httpx (backend external API calls), axios (frontend) |
| Icons | lucide-react |
| Notifications | react-hot-toast |

---

## Scenarios / Key User Flows

### Scenario 1: Paper Discovery & Management
Researchers query academic databases through a search interface. Results show title, authors, date, abstract. Papers are imported into personal workspaces with one click. The React frontend provides intuitive browsing while FastAPI handles API calls and user management.

### Scenario 2: AI-Powered Research Analysis
The chatbot powered by Gemini answers research-specific questions by accessing paper content. Researchers can ask "What are key differences between transformer and CNN architectures?" or "Summarize main findings across papers?" The AI synthesizes information across multiple documents.

### Scenario 3: Workspace Collaboration & Knowledge Management
Researchers create multiple workspaces for different projects (e.g., "Deep Learning Research", "Medical Imaging Analysis"). The AI chatbot maintains context-specific conversations. The system stores conversation history and paper relationships. JWT-based auth protects data.

---

## Project Structure

```
genai/
├── plan.md                            ← THIS FILE (master plan)
└── ResearchHub-AI/
    ├── README.md
    ├── backend/
    │   ├── main.py                    # FastAPI app entry, CORS, router includes, DB init
    │   ├── requirements.txt           # Python dependencies
    │   ├── .env                       # GEMINI_API_KEY, SECRET_KEY, DATABASE_URL
    │   ├── skills.md                  # Backend dev guide for AI agents
    │   ├── models/
    │   │   ├── __init__.py            # Exports all models
    │   │   ├── user.py                # User SQLAlchemy model
    │   │   ├── paper.py               # Paper SQLAlchemy model
    │   │   ├── workspace.py           # Workspace SQLAlchemy model
    │   │   └── conversation.py        # Conversation SQLAlchemy model
    │   ├── routers/
    │   │   ├── __init__.py
    │   │   ├── auth.py                # POST /register, POST /login
    │   │   ├── papers.py              # GET /search, POST /import, POST /upload, GET /workspace/{id}, DELETE /{id}
    │   │   ├── chat.py                # POST /chat, GET /history/{workspace_id}
    │   │   └── workspaces.py          # CRUD for workspaces
    │   └── utils/
    │       ├── __init__.py
    │       ├── gemini_client.py       # Gemini SDK init + get_gemini_response() helper
    │       ├── research_assistant.py  # ResearchAssistant class: context builder, AI calls
    │       ├── database.py            # SQLAlchemy engine, async session, Base
    │       └── auth_utils.py          # JWT create/verify, password hash, get_current_user
    └── frontend/
        ├── index.html
        ├── package.json
        ├── vite.config.js
        ├── tailwind.config.js
        ├── postcss.config.js
        ├── skills.md                  # Frontend dev guide for AI agents
        └── src/
            ├── main.jsx               # ReactDOM entry
            ├── App.jsx                # Root component with routes
            ├── index.css              # Tailwind imports
            ├── components/
            │   ├── Navbar.jsx         # Top navigation bar
            │   ├── Sidebar.jsx        # Workspace sidebar navigation
            │   ├── PaperCard.jsx      # Paper metadata display card
            │   ├── ChatInterface.jsx  # Chat message list + input box
            │   ├── SearchBar.jsx      # Debounced search input
            │   ├── ProtectedRoute.jsx # Auth guard wrapper
            │   └── FileUpload.jsx     # Drag-and-drop PDF upload
            ├── pages/
            │   ├── LoginPage.jsx
            │   ├── RegisterPage.jsx
            │   ├── HomePage.jsx
            │   ├── DashboardPage.jsx
            │   ├── SearchPage.jsx
            │   ├── WorkspacesPage.jsx
            │   ├── WorkspaceDetailPage.jsx
            │   ├── AIToolsPage.jsx
            │   ├── UploadPage.jsx
            │   └── DocSpacePage.jsx
            └── utils/
                ├── api.js             # Axios instance + interceptors
                └── AuthContext.jsx    # React context for auth state
```

---

## Key Features

1. **User Registration & Login** — JWT-based authentication with bcrypt password hashing
2. **Research Paper Search** — Query OpenAlex academic API, display results with metadata
3. **Paper Import** — One-click import into user's workspace
4. **PDF Upload** — Drag-and-drop PDF upload with text extraction (PyPDF2)
5. **Workspace Management** — Create/edit/delete project-specific workspaces
6. **AI Chatbot** — Context-aware Q&A powered by Gemini, scoped to workspace papers
7. **AI Tools** — Summarize, compare papers, extract key findings
8. **Conversation History** — Persistent chat history per workspace
9. **Doc Space** — Centralized document management across all workspaces
10. **Vector-based Semantic Search** — sentence-transformers embeddings for conceptual similarity

---

## Milestones & Steps

### Milestone 1: Project Setup & Dependencies

**Step 1.1** — Create the full folder structure (DONE — see above).

**Step 1.2** — Create `backend/requirements.txt` with these dependencies:
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

**Step 1.3** — Create Python virtual environment and install backend deps:
```bash
cd ResearchHub-AI/backend
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
```

**Step 1.4** — Scaffold React frontend with Vite (JavaScript template):
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install axios react-router-dom lucide-react react-hot-toast
npm install -D tailwindcss @tailwindcss/vite
```

**Step 1.5** — Configure Tailwind CSS in `vite.config.js`, `tailwind.config.js`, and `src/index.css`.

---

### Milestone 2: Gemini API Integration (replaces Groq)

**Step 2.1** — Get API key from [Google AI Studio](https://aistudio.google.com/) → Create API Key.

**Step 2.2** — Create `backend/.env`:
```
GEMINI_API_KEY=your_google_ai_api_key_here
SECRET_KEY=your_jwt_secret_key_here
DATABASE_URL=sqlite+aiosqlite:///./researchhub.db
```

**Step 2.3** — Implement `backend/utils/gemini_client.py`:
- Import `google.generativeai as genai`
- Configure with API key from env
- Create model: `genai.GenerativeModel("gemini-2.0-flash")`
- Define generation config: `temperature=0.3, max_output_tokens=2000, top_p=0.9`
- Export `get_gemini_response(system_prompt, user_prompt)` helper function

**Key Gemini API pattern** (differs from Groq/OpenAI):
```python
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash",
    system_instruction="You are an expert research assistant."
)
response = model.generate_content(
    user_prompt,
    generation_config=genai.GenerationConfig(
        temperature=0.3, max_output_tokens=2000, top_p=0.9
    )
)
return response.text
```
- No `messages` array with roles — use `system_instruction` parameter on model
- Response is `response.text` (NOT `response.choices[0].message.content`)
- Config uses `max_output_tokens` (NOT `max_tokens`)

---

### Milestone 3: Backend Development with FastAPI

**Step 3.1** — Create `backend/utils/database.py`:
- Async SQLAlchemy engine with `DATABASE_URL`
- `async_sessionmaker` for sessions
- `Base = declarative_base()`
- `get_db()` async dependency for FastAPI
- `init_db()` to create all tables

**Step 3.2** — Define SQLAlchemy models in `backend/models/`:
- **User**: id, email (unique), username, hashed_password, created_at
- **Paper**: id, title, authors (string), abstract (text), url, doi, published_date, content (text, for PDFs), user_id (FK→User), workspace_id (FK→Workspace), imported_at
- **Workspace**: id, name, description, user_id (FK→User), created_at
- **Conversation**: id, workspace_id (FK→Workspace), user_id (FK→User), user_message (text), ai_response (text), created_at

**Step 3.3** — Create `backend/utils/auth_utils.py`:
- `hash_password(password)` → bcrypt hash
- `verify_password(plain, hashed)` → bool
- `create_access_token(data, expires_delta=30min)` → JWT (HS256)
- `get_current_user(token)` → decode JWT, query user, raise 401 if invalid

**Step 3.4** — Create `backend/routers/auth.py` (prefix `/api/auth`):
- `POST /register` — validate, hash password, insert User, return success
- `POST /login` — verify credentials, return `{access_token, token_type, user}`

**Step 3.5** — Create `backend/routers/workspaces.py` (prefix `/api/workspaces`):
- `POST /` — create workspace
- `GET /` — list user's workspaces with paper counts
- `GET /{id}` — single workspace details
- `PUT /{id}` — update workspace
- `DELETE /{id}` — delete workspace + associated papers/conversations

**Step 3.6** — Create `backend/routers/papers.py` (prefix `/api/papers`):
- `GET /search?query=` — query OpenAlex API (`https://api.openalex.org/works?search={query}&per_page=20`), parse results
- `POST /import` — import paper to workspace
- `POST /upload` — accept PDF file + workspace_id, extract text with PyPDF2, store
- `GET /workspace/{workspace_id}` — list papers in workspace
- `DELETE /{paper_id}` — delete paper

**Step 3.7** — Create `backend/routers/chat.py` (prefix `/api/chat`):
- `POST /` — accept `{message, workspace_id}`, build context from papers, call Gemini, store conversation, return AI response
- `GET /history/{workspace_id}` — return conversation history

**Step 3.8** — Create `backend/main.py`:
- Initialize FastAPI app
- Add CORS middleware (origins: `http://localhost:5173`)
- Include all routers
- On startup: call `init_db()`
- Root endpoint: `GET /` → `{"message": "ResearchHub AI API is running"}`

---

### Milestone 4: Frontend Development (React + JavaScript + Tailwind)

**Step 4.1** — Create `src/utils/api.js` — Axios instance with base URL, JWT interceptor, 401 handler.

**Step 4.2** — Create `src/utils/AuthContext.jsx` — React context providing `{user, token, login, logout, isAuthenticated}`.

**Step 4.3** — Create `src/components/ProtectedRoute.jsx` — redirect to `/login` if not authenticated.

**Step 4.4** — Create `src/App.jsx` — all routes wrapped in AuthProvider + BrowserRouter.

**Step 4.5** — Build all pages:
| Page | Route | Description |
|------|-------|-------------|
| LoginPage | `/login` | Email + password form, calls login API |
| RegisterPage | `/register` | Username + email + password form |
| HomePage | `/` | Hero section + feature cards + CTA |
| DashboardPage | `/dashboard` | Stats, recent papers, workspace shortcuts |
| SearchPage | `/search` | Search bar + results grid + import button |
| WorkspacesPage | `/workspaces` | Workspace list + create modal |
| WorkspaceDetailPage | `/workspace/:id` | Papers list + AI chat (split view) |
| AIToolsPage | `/ai-tools` | Select workspace/papers, run AI tools |
| UploadPage | `/upload` | Drag-and-drop PDF + workspace selector |
| DocSpacePage | `/docspace` | All documents across workspaces |

**Step 4.6** — Build reusable components:
| Component | Purpose |
|-----------|---------|
| Navbar | Top nav bar with links, user menu, logout |
| Sidebar | Workspace list sidebar |
| PaperCard | Paper metadata card with import/delete |
| ChatInterface | Chat messages + input + send |
| SearchBar | Debounced search input |
| FileUpload | Drag-and-drop PDF zone |

---

### Milestone 5: AI Agent & Context Management

**Step 5.1** — Create `backend/utils/research_assistant.py`:
- `ResearchAssistant` class with:
  - `create_research_context(papers, query)` — build context from paper metadata/content
  - `generate_research_response(context, query)` — call Gemini with context
  - `summarize_paper(paper)` — single-paper summary
  - `compare_papers(papers)` — multi-paper comparison
  - `extract_key_findings(papers)` — extract findings across papers

**Step 5.2** — Vector-based semantic search (enhancement):
- On paper import/upload, compute embedding via sentence-transformers `all-MiniLM-L6-v2`
- Store embeddings in Paper model
- On chat query, compute query embedding, find top-k papers by cosine similarity
- Use only top-k most relevant papers in Gemini context

---

### Milestone 6: Testing & Deployment

**Step 6.1** — Run backend:
```bash
cd ResearchHub-AI/backend
venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Verify at `http://localhost:8000/docs` (Swagger UI).

**Step 6.2** — Run frontend:
```bash
cd ResearchHub-AI/frontend
npm run dev
```
Dev server at `http://localhost:5173`.

**Step 6.3** — CORS configured in `main.py`: origins `["http://localhost:5173"]`, credentials=True, all methods/headers allowed.

**Step 6.4** — Full integration test flow:
1. Register → Login → JWT stored
2. Create workspace
3. Search papers → Import 2-3 papers
4. Upload a PDF
5. Open workspace → Chat with AI about papers
6. Use AI Tools → Summarize/Compare
7. Check Doc Space for all documents

---

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, get JWT |
| GET | `/api/papers/search?query=` | Yes | Search academic papers via OpenAlex |
| POST | `/api/papers/import` | Yes | Import paper to workspace |
| POST | `/api/papers/upload` | Yes | Upload PDF to workspace |
| GET | `/api/papers/workspace/{id}` | Yes | List papers in workspace |
| DELETE | `/api/papers/{id}` | Yes | Delete paper |
| POST | `/api/workspaces` | Yes | Create workspace |
| GET | `/api/workspaces` | Yes | List user's workspaces |
| GET | `/api/workspaces/{id}` | Yes | Get workspace details |
| PUT | `/api/workspaces/{id}` | Yes | Update workspace |
| DELETE | `/api/workspaces/{id}` | Yes | Delete workspace |
| POST | `/api/chat` | Yes | Send message, get AI response |
| GET | `/api/chat/history/{id}` | Yes | Get chat history for workspace |

---

## Environment Variables (.env in backend/)

```
GEMINI_API_KEY=       # From https://aistudio.google.com/
SECRET_KEY=           # Random string for JWT signing (openssl rand -hex 32)
DATABASE_URL=         # sqlite+aiosqlite:///./researchhub.db (dev)
```

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI Model | Gemini 2.0 Flash (not Groq/Llama) | User requirement; free tier via Google AI Studio |
| Frontend Lang | JavaScript (not TypeScript) | User requirement; simpler setup |
| Frontend Build | Vite (not CRA) | Faster dev server, modern tooling |
| Database | SQLite for dev | Zero config; swap to PostgreSQL via DATABASE_URL |
| Academic API | OpenAlex | Free, no API key, rich metadata, good coverage |
| CSS Framework | Tailwind CSS | Utility-first, rapid UI development |

---

## OpenAlex API Notes

Used for academic paper search (free, no API key required).

**Endpoint**: `GET https://api.openalex.org/works?search={query}&per_page=20`

**Response parsing**:
- `results[].title` → paper title
- `results[].authorships[].author.display_name` → author names (join with ", ")
- `results[].abstract_inverted_index` → inverted index dict, reconstruct into text:
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
- `results[].doi` → DOI URL
- `results[].primary_location.landing_page_url` → paper URL
- `results[].publication_date` → date string

---

## Implementation Order

When implementing, follow this order for the backend:
1. `utils/database.py` → `models/*` → `utils/auth_utils.py` → `utils/gemini_client.py`
2. `routers/auth.py` → `routers/workspaces.py` → `routers/papers.py`
3. `utils/research_assistant.py` → `routers/chat.py`
4. `main.py` (ties everything together)

For the frontend:
1. `utils/api.js` → `utils/AuthContext.jsx`
2. `components/ProtectedRoute.jsx` → `components/Navbar.jsx`
3. `pages/LoginPage.jsx` → `pages/RegisterPage.jsx` → `pages/HomePage.jsx`
4. `components/PaperCard.jsx` → `components/SearchBar.jsx` → `pages/SearchPage.jsx`
5. `pages/WorkspacesPage.jsx` → `components/ChatInterface.jsx` → `pages/WorkspaceDetailPage.jsx`
6. `components/FileUpload.jsx` → `pages/UploadPage.jsx`
7. `pages/AIToolsPage.jsx` → `pages/DocSpacePage.jsx` → `pages/DashboardPage.jsx`
8. `App.jsx` → `main.jsx`

---

## Context Files for AI Agents

- **This file (`plan.md`)**: Full project context, architecture, milestones, API specs
- **`backend/skills.md`**: Backend-specific implementation guide with code patterns, file details, DB schema
- **`frontend/skills.md`**: Frontend-specific implementation guide with component specs, page layouts, styling conventions
