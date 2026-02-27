# ResearchHub AI

An AI-powered research paper management platform. Search for academic papers via OpenAlex, organise them into workspaces, upload PDFs, and interact with an AI chatbot that provides contextual insights, summaries, and comparisons backed by your paper content.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, JavaScript (JSX) |
| Backend | Python 3.10+, FastAPI 0.104.1, Uvicorn |
| Database | PostgreSQL (via SQLAlchemy 2.0 async + asyncpg) |
| LLM (Chat & Tools) | Groq — Llama 3.3 70B Versatile |
| LLM (Deep Research) | Groq — openai/gpt-oss-20b with browser_search tool |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`) |
| Vector Store | ChromaDB (persistent, cosine similarity) |
| PDF Parsing | PyPDF2 |
| Academic Search API | OpenAlex (free, no key required) |
| PDF Proxy / OA Lookup | Unpaywall API |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| HTTP Client | httpx (backend), axios (frontend) |
| UI Libraries | framer-motion, lucide-react, react-hot-toast, lenis (smooth scroll) |

---

## Project Structure

```
ResearchHub-AI/
├── README.md
├── backend/
│   ├── main.py                    # FastAPI app, CORS, lifespan, router mounting
│   ├── requirements.txt           # Python dependencies
│   ├── .env                       # Environment variables (you create this)
│   ├── chroma_data/               # ChromaDB persistent storage (auto-created)
│   ├── models/
│   │   ├── user.py                # User model
│   │   ├── paper.py               # Paper model (stores PDF bytes + extracted text)
│   │   ├── workspace.py           # Workspace model
│   │   └── conversation.py        # Conversation model (chat history)
│   ├── routers/
│   │   ├── auth.py                # POST /register, POST /login
│   │   ├── papers.py              # Search, import, upload, list, delete, PDF proxy
│   │   ├── workspaces.py          # CRUD for workspaces
│   │   └── chat.py                # AI chat, chat history, AI tools (summarize/compare/findings)
│   └── utils/
│       ├── database.py            # SQLAlchemy async engine, session, Base, migrations
│       ├── auth_utils.py          # JWT creation/verification, password hashing
│       ├── groq_client.py         # Groq Llama 3.3 70B + browser_search client
│       ├── research_assistant.py  # Context builder + AI response generation
│       └── vector_store.py        # ChromaDB: chunking, embedding, semantic retrieval
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx               # ReactDOM entry point
        ├── App.jsx                # Root component, routes, AuthProvider
        ├── index.css              # Tailwind directives
        ├── components/
        │   ├── Navbar.jsx         # Top navigation bar
        │   ├── Sidebar.jsx        # Workspace sidebar
        │   ├── ChatInterface.jsx  # Chat message list + input
        │   ├── SearchBar.jsx      # Debounced search input
        │   ├── PaperCard.jsx      # Paper metadata display card
        │   ├── FileUpload.jsx     # Drag-and-drop PDF upload
        │   ├── ProtectedRoute.jsx # Auth guard wrapper
        │   ├── KnowledgeGraph.jsx # Knowledge graph visualisation
        │   ├── AnimatedSection.jsx
        │   ├── BentoCard.jsx
        │   ├── FeatureCard.jsx
        │   ├── Plasma.jsx
        │   ├── ResearchTicker.jsx
        │   └── TypewriterEffect.jsx
        ├── pages/
        │   ├── HomePage.jsx
        │   ├── LoginPage.jsx
        │   ├── RegisterPage.jsx
        │   ├── DashboardPage.jsx
        │   ├── SearchPage.jsx
        │   ├── WorkspacesPage.jsx
        │   ├── WorkspaceDetailPage.jsx
        │   ├── AIToolsPage.jsx
        │   ├── UploadPage.jsx
        │   └── DocSpacePage.jsx
        └── utils/
            ├── api.js             # Axios instance with JWT interceptor
            ├── AuthContext.jsx    # React context for auth state
            └── motionVariants.js  # Framer-motion animation presets
```

---

## Prerequisites

- **Python** 3.10 or higher
- **Node.js** 18+ and **npm**
- **PostgreSQL** running locally (default connection: `localhost:5432`, database `researchhub`)
- A **Groq API key** — get one free at <https://console.groq.com>

---

## Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
# Required
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
SECRET_KEY=your-random-secret-key

# PostgreSQL connection string (async driver)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/researchhub


# Optional — ChromaDB storage path (defaults to ./chroma_data)
CHROMA_PERSIST_DIR=./chroma_data
```

> **Tip:** You can provide multiple comma-separated API keys for both `GROQ_API_KEY` to enable automatic key rotation when rate limits are hit.

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd ResearchHub-AI
```

### 2. Set up PostgreSQL

Create a database named `researchhub` (or update `DATABASE_URL` accordingly):

```sql
CREATE DATABASE researchhub;
```

Tables are created automatically on first startup via SQLAlchemy's `create_all`.

### 3. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create the .env file (see Environment Variables section above)

# Start the server
uvicorn main:app --reload --port 8000
```

The API will be available at **http://localhost:8000**. Visit http://localhost:8000/docs for the interactive Swagger UI.

> **Note:** On the first run the embedding model (`all-MiniLM-L6-v2`) will be downloaded automatically by sentence-transformers (~80 MB). This happens in a background thread and does not block the server.

### 4. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at **http://localhost:5173**.

---

## API Endpoints

### Auth — `/api/auth`

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user (`email`, `username`, `password`) |
| POST | `/api/auth/login` | Login, returns JWT `access_token` |

### Workspaces — `/api/workspaces`

| Method | Path | Description |
|---|---|---|
| POST | `/api/workspaces` | Create a workspace |
| GET | `/api/workspaces` | List all workspaces (with paper counts) |
| GET | `/api/workspaces/{id}` | Get a single workspace |
| PUT | `/api/workspaces/{id}` | Update workspace name/description |
| DELETE | `/api/workspaces/{id}` | Delete workspace and all its papers/conversations |

### Papers — `/api/papers`

| Method | Path | Description |
|---|---|---|
| GET | `/api/papers/search?query=...` | Search academic papers via OpenAlex |
| POST | `/api/papers/import` | Import a paper into a workspace (auto-fetches PDF if OA) |
| POST | `/api/papers/upload` | Upload a PDF file to a workspace |
| GET | `/api/papers/workspace/{id}` | List papers in a workspace |
| GET | `/api/papers/{id}/pdf` | Serve stored PDF (inline) |
| GET | `/api/papers/{id}/download` | Download stored PDF |
| GET | `/api/papers/{id}/preview` | Get text-based content preview |
| POST | `/api/papers/proxy-pdf` | Proxy-fetch a PDF from external URL (bypasses CORS) |
| DELETE | `/api/papers/{id}` | Delete a paper and its vector embeddings |

### Chat — `/api/chat`

| Method | Path | Description |
|---|---|---|
| POST | `/api/chat` | Send a message — uses paper-context RAG (or web search if `web_search: true`) |
| GET | `/api/chat/history/{workspace_id}` | Get conversation history for a workspace |
| POST | `/api/chat/tool` | Run an AI tool: `summarize`, `compare`, or `findings` |

---

## Features

### Paper Discovery
Search academic papers through OpenAlex. Results include title, authors, abstract, publication date, and DOI. Import papers into any workspace with one click — the system automatically attempts to fetch the open-access PDF.

### PDF Upload & Processing
Upload your own PDF files via drag-and-drop. PyPDF2 extracts text content, which is then chunked and embedded into ChromaDB for semantic retrieval.

### AI Chat (RAG)
Chat with an AI assistant that has context of all papers in your workspace. The system retrieves the most relevant chunks from the vector store using semantic search, builds a context window, and sends it to Llama 3.3 70B via Groq for generation.

### Deep Research (Web Search)
Toggle "Deep Research" mode in the chat to use Groq's browser_search tool with the `openai/gpt-oss-20b` model. This performs real-time web searches and returns results with citations.

### AI Tools
- **Summarize** — Generate a concise summary of a selected paper
- **Compare** — Compare two or more papers (methodologies, findings, differences)
- **Key Findings** — Extract key findings across selected papers

### Workspaces
Organise papers into project-specific workspaces. Each workspace maintains its own chat history and paper collection.

### Authentication
JWT-based authentication with bcrypt password hashing. Tokens expire after 30 minutes. The frontend stores the token in `localStorage` and attaches it to every API request via an axios interceptor.

### Vector Store (ChromaDB)
Paper content is split into overlapping chunks (500 chars, 50 char overlap) and embedded using `all-MiniLM-L6-v2`. Queries are matched using cosine similarity. Embeddings are persisted on disk in the `chroma_data/` directory.

---

## Frontend Routes

| Path | Page | Auth Required |
|---|---|---|
| `/` | Home / Landing page | No |
| `/login` | Login | No |
| `/register` | Register | No |
| `/dashboard` | Dashboard | Yes |
| `/search` | Paper search | Yes |
| `/workspaces` | Workspace list | Yes |
| `/workspace/:id` | Workspace detail (papers + chat) | Yes |
| `/ai-tools` | AI tools page | Yes |
| `/upload` | PDF upload | Yes |
| `/docspace` | Document space | Yes |

---

## Rate Limiting & Key Rotation

The Groq client implement:

- **Minimum request gap** — enforces a delay between consecutive API calls (2s for Groq)
- **Response caching** — identical prompts return cached results for 10 minutes
- **Retry with backoff** — retries up to 2 times on 429 errors (5s, then 10s delay)
- **API key rotation** — if multiple comma-separated keys are provided, the system automatically rotates to the next key when rate limits are hit

---

## Build for Production

### Frontend

```bash
cd frontend
npm run build
```

Output is in `frontend/dist/`.

### Backend

Run with a production ASGI server:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```
