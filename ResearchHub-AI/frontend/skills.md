# Frontend Skills — ResearchHub AI

## Purpose

This file provides complete context for any AI agent or developer to build, modify, or extend the ResearchHub AI frontend. Read this file before making any frontend changes. For full project context, also read `../../plan.md`.

---

## Tech Stack

- **Framework**: React 18+ (**JavaScript — NOT TypeScript**)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (utility-first, no CSS modules, no styled-components)
- **Routing**: react-router-dom v6
- **HTTP Client**: axios
- **Icons**: lucide-react
- **Notifications**: react-hot-toast

---

## Frontend Structure

```
frontend/
├── index.html                 # Vite HTML entry
├── package.json               # NPM dependencies + scripts
├── vite.config.js             # Vite configuration + Tailwind plugin
├── tailwind.config.js         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS config
├── skills.md                  # THIS FILE
└── src/
    ├── main.jsx               # ReactDOM entry point
    ├── App.jsx                # Root component with routes + providers
    ├── index.css              # Tailwind base/components/utilities imports
    ├── components/
    │   ├── Navbar.jsx         # Top navigation bar
    │   ├── Sidebar.jsx        # Workspace sidebar navigation
    │   ├── PaperCard.jsx      # Paper metadata display card
    │   ├── ChatInterface.jsx  # Chat message list + input box
    │   ├── SearchBar.jsx      # Debounced search input
    │   ├── ProtectedRoute.jsx # Auth guard — redirects to /login if unauthenticated
    │   └── FileUpload.jsx     # Drag-and-drop PDF upload zone
    ├── pages/
    │   ├── LoginPage.jsx      # Login form
    │   ├── RegisterPage.jsx   # Registration form
    │   ├── HomePage.jsx       # Landing page with features
    │   ├── DashboardPage.jsx  # User dashboard (stats, recent activity)
    │   ├── SearchPage.jsx     # Paper search + results grid
    │   ├── WorkspacesPage.jsx # Workspace list + create workspace
    │   ├── WorkspaceDetailPage.jsx  # Single workspace: papers + AI chat
    │   ├── AIToolsPage.jsx    # AI analysis tools (summarize, compare, etc.)
    │   ├── UploadPage.jsx     # PDF upload page
    │   └── DocSpacePage.jsx   # All documents view across workspaces
    └── utils/
        ├── api.js             # Axios instance with base URL + JWT interceptor
        └── AuthContext.jsx    # React context for auth state (user, token, login, logout)
```

---

## NPM Dependencies

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "axios": "^1.x",
    "lucide-react": "^0.x",
    "react-hot-toast": "^2.x"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.x",
    "vite": "^5.x",
    "tailwindcss": "^3.x",
    "@tailwindcss/vite": "^4.x"
  }
}
```

---

## Conventions & Patterns

### JavaScript (NOT TypeScript)
All files use `.jsx` extension. No TypeScript, no `.tsx`, no type annotations. No PropTypes required (optional).

### File Naming
- Components and pages: `PascalCase.jsx` (e.g., `Navbar.jsx`, `LoginPage.jsx`)
- Utilities: `camelCase.js` (e.g., `api.js`)
- Context files: `PascalCase.jsx` (e.g., `AuthContext.jsx`)

### Styling — Tailwind CSS Only
Use Tailwind utility classes exclusively. No CSS modules, no styled-components, no inline styles (except computed dynamic values).

```jsx
// CORRECT
<div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
  <h2 className="text-xl font-bold text-gray-800 mb-2">Title</h2>
  <p className="text-gray-600 text-sm">Description</p>
</div>

// WRONG — do not use inline styles or CSS modules
<div style={{ backgroundColor: 'white' }}>...</div>
```

### Component Pattern
```jsx
import { useState, useEffect } from 'react';

export default function ComponentName({ prop1, prop2, onAction }) {
  const [state, setState] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // side effects here
  }, [dependencies]);

  const handleAction = async () => {
    setLoading(true);
    try {
      // do something
    } catch (err) {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="...">
      {/* JSX content */}
    </div>
  );
}
```

### API Calls
Always use the shared axios instance from `utils/api.js`:

```jsx
import api from '../utils/api';

// GET request
const response = await api.get('/papers/search', { params: { query } });
const papers = response.data.papers;

// POST request
const response = await api.post('/papers/import', paperData);

// POST with file upload (FormData)
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('workspace_id', workspaceId);
const response = await api.post('/papers/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// DELETE request
await api.delete(`/papers/${paperId}`);
```

### Auth Pattern
Use the auth context for login state and user info:

```jsx
import { useAuth } from '../utils/AuthContext';

export default function MyComponent() {
  const { user, token, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) return <p>Please log in</p>;
  return <p>Welcome, {user.username}!</p>;
}
```

### Error Handling
Wrap API calls in try/catch and show errors with react-hot-toast:

```jsx
import toast from 'react-hot-toast';

const handleSubmit = async () => {
  try {
    const res = await api.post('/auth/login', { email, password });
    toast.success('Logged in successfully!');
  } catch (err) {
    toast.error(err.response?.data?.detail || 'Something went wrong');
  }
};
```

### Navigation
Use `react-router-dom` hooks:

```jsx
import { useNavigate, useParams, Link } from 'react-router-dom';

const navigate = useNavigate();
navigate('/dashboard');

const { id } = useParams();  // from /workspace/:id

<Link to="/search" className="text-blue-600 hover:underline">Search Papers</Link>
```

---

## Routing Structure

All routes defined in `App.jsx`. Protected routes use `ProtectedRoute` wrapper.

| Route | Component | Auth Required | Description |
|-------|-----------|---------------|-------------|
| `/` | HomePage | No | Landing page |
| `/login` | LoginPage | No | Login form |
| `/register` | RegisterPage | No | Register form |
| `/dashboard` | DashboardPage | Yes | User dashboard |
| `/search` | SearchPage | Yes | Paper search |
| `/workspaces` | WorkspacesPage | Yes | Workspace list |
| `/workspace/:id` | WorkspaceDetailPage | Yes | Workspace detail + chat |
| `/ai-tools` | AIToolsPage | Yes | AI analysis tools |
| `/upload` | UploadPage | Yes | PDF upload |
| `/docspace` | DocSpacePage | Yes | All documents |

---

## File-by-File Implementation Guide

### `src/utils/api.js`

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

### `src/utils/AuthContext.jsx`

```javascript
import { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const isAuthenticated = !!token;

  // Don't render children until we check localStorage
  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

### `src/components/ProtectedRoute.jsx`

```javascript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
```

---

### `src/App.jsx`

```javascript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './utils/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import WorkspacesPage from './pages/WorkspacesPage';
import WorkspaceDetailPage from './pages/WorkspaceDetailPage';
import AIToolsPage from './pages/AIToolsPage';
import UploadPage from './pages/UploadPage';
import DocSpacePage from './pages/DocSpacePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Toaster position="top-right" />
        <main className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
            <Route path="/workspaces" element={<ProtectedRoute><WorkspacesPage /></ProtectedRoute>} />
            <Route path="/workspace/:id" element={<ProtectedRoute><WorkspaceDetailPage /></ProtectedRoute>} />
            <Route path="/ai-tools" element={<ProtectedRoute><AIToolsPage /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
            <Route path="/docspace" element={<ProtectedRoute><DocSpacePage /></ProtectedRoute>} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

---

## Page Specifications

### LoginPage.jsx
- **Layout**: Centered card on gradient/neutral background
- **Fields**: Email input, Password input (both with labels)
- **Buttons**: "Sign In" (primary blue), "Don't have an account? Register" link
- **Validation**: Both fields required, basic email format check
- **On submit**: Call `login(email, password)` from AuthContext
- **On success**: `navigate('/dashboard')`
- **On error**: `toast.error(message)`
- **State**: `email`, `password`, `loading`

### RegisterPage.jsx
- **Layout**: Same centered card style as LoginPage
- **Fields**: Username, Email, Password, Confirm Password
- **Buttons**: "Create Account" (primary), "Already have an account? Login" link
- **Validation**: All required, passwords must match, email format
- **On submit**: `api.post('/auth/register', { username, email, password })`
- **On success**: `toast.success('Account created!')`, `navigate('/login')`
- **On error**: `toast.error(message)`

### HomePage.jsx
- **Layout**: Full-width sections, no auth required
- **Hero section**: Large title "ResearchHub AI", subtitle about AI-powered research management, CTA button "Get Started" → `/register`, secondary "Login" → `/login`
- **Features section**: 6 feature cards in 2x3 or 3x2 grid:
  1. Paper Search — "Search millions of academic papers"
  2. Workspaces — "Organize papers by project"
  3. AI Chat — "Chat with AI about your papers"
  4. AI Tools — "Summarize, compare, extract findings"
  5. PDF Upload — "Upload your own PDF papers"
  6. Doc Space — "Manage all documents in one place"
- **Icons**: Use lucide-react icons (Search, FolderOpen, MessageSquare, Wand2, Upload, FileText)

### DashboardPage.jsx
- **Layout**: Stats row (3 cards) + recent papers section + workspace shortcuts
- **Stats cards**: Total Papers, Total Workspaces, Total Conversations — fetched from relevant API endpoints
- **Recent papers**: Last 5 imported papers as PaperCard list
- **Quick links**: Cards linking to Search, Workspaces, AI Tools
- **API calls on mount**: `GET /workspaces`, then `GET /papers/workspace/{id}` for each workspace

### SearchPage.jsx
- **Layout**: SearchBar at top, results grid below
- **Search flow**: User types → debounce 300ms → `GET /api/papers/search?query=...`
- **Results**: Grid of PaperCard components (2 or 3 columns)
- **Import**: Each PaperCard has "Import" button → opens modal/dropdown to select workspace → calls `POST /api/papers/import`
- **States**:
  - Initial: "Enter a search term to find papers"
  - Loading: Spinner/skeleton
  - Results: Paper cards grid
  - Empty: "No papers found"
  - Error: Error message

### WorkspacesPage.jsx
- **Layout**: Header with "Create Workspace" button + workspace cards grid
- **Create modal**: Modal/dialog with Name input + Description textarea
- **Workspace cards**: Name, description preview, paper count, created date. Click card → navigate to `/workspace/:id`
- **API**: `GET /api/workspaces` on mount, `POST /api/workspaces` to create

### WorkspaceDetailPage.jsx
- **Layout**: Two-panel layout (side by side on desktop, stacked on mobile)
- **Left panel** (40% width):
  - Workspace name + description header
  - Paper list — PaperCard for each paper, with delete button
  - "No papers yet" empty state
- **Right panel** (60% width):
  - ChatInterface component
- **URL param**: `const { id } = useParams()`
- **API on mount**: `GET /api/papers/workspace/:id`, `GET /api/chat/history/:id`

### AIToolsPage.jsx
- **Layout**: Step-by-step flow
  1. Workspace selector dropdown (load from `GET /api/workspaces`)
  2. Paper list with checkboxes (loaded when workspace selected)
  3. Tool buttons row: "Summarize", "Compare Papers", "Extract Key Findings"
  4. Results display area (markdown-like text)
- **Flow**: Select workspace → papers load → select 1+ papers → click tool → loading → display result
- **API**: Uses `POST /api/chat` with tool-specific prompts (e.g., "Summarize the following papers: ...")

### UploadPage.jsx
- **Layout**: Centered card with FileUpload component + workspace selector
- **Fields**: Workspace dropdown (required), FileUpload component
- **On submit**: Create FormData, `POST /api/papers/upload`
- **Feedback**: Upload progress (optional), success toast, error toast

### DocSpacePage.jsx
- **Layout**: Filter bar + document grid
- **Filters**: Workspace dropdown (including "All" option), search-by-title input
- **Content**: All papers across all workspaces, displayed as PaperCard grid
- **Each card**: Shows workspace name as badge/tag
- **API**: Fetch all workspaces, then all papers for each

---

## Component Specifications

### Navbar.jsx

```
┌────────────────────────────────────────────────────────────────┐
│  🔬 ResearchHub AI  │ Dashboard │ Search │ Workspaces │ ...  │ User ▾ │
└────────────────────────────────────────────────────────────────┘
```

- **Logo**: App name "ResearchHub AI" with icon, links to `/`
- **Nav links** (only when authenticated): Dashboard, Search, Workspaces, AI Tools, Upload, Doc Space
- **User section** (when authenticated): Username display, Logout button
- **When not authenticated**: Show "Login" and "Register" links
- **Styling**: White bg, shadow-sm, sticky top, z-50
- **Mobile**: Hamburger menu icon, collapsible nav
- **Active link**: Blue text + bottom border (use `useLocation()` to detect)

### PaperCard.jsx

```
┌─────────────────────────────────────────┐
│ Paper Title                              │
│ 👤 Author1, Author2, Author3            │
│ 📅 2024-01-15                           │
│ Abstract: First 150 characters of the   │
│ abstract text goes here...               │
│                      [Import] [Delete]   │
└─────────────────────────────────────────┘
```

- **Props**: `paper` (object), `onImport` (function, optional), `onDelete` (function, optional), `showImport` (bool, default false), `showDelete` (bool, default false), `workspaceName` (string, optional — for DocSpace)
- **Display**: Title (bold), authors (gray), date (gray/small), abstract (truncated to ~150 chars with "...")
- **Buttons**: Conditional based on props
- **Styling**: White card, rounded-lg, shadow, hover elevation, p-4/p-6

### ChatInterface.jsx

```
┌─────────────────────────────────────┐
│ 🤖 Welcome! Ask me about your      │
│    research papers.                  │
│                                     │
│              What are the key  🧑  │
│              findings in paper X?    │
│                                     │
│ 🤖 Based on the paper, the main    │
│    findings include...               │
│                                     │
├─────────────────────────────────────┤
│ [Type your message...         ] [➤] │
└─────────────────────────────────────┘
```

- **Props**: `workspaceId` (number)
- **State**: `messages` (array of `{role: 'user'|'ai', content: string}`), `input` (string), `loading` (bool)
- **On mount**: Fetch history from `GET /api/chat/history/{workspaceId}`, populate messages
- **On send**:
  1. Add user message to messages array
  2. Set loading=true
  3. Call `POST /api/chat` with `{message: input, workspace_id: workspaceId}`
  4. Add AI response to messages array
  5. Set loading=false
  6. Clear input
- **Auto-scroll**: `useRef` on message container, scroll to bottom after new message
- **Message styling**:
  - User: right-aligned, `bg-blue-500 text-white`, rounded-lg
  - AI: left-aligned, `bg-gray-100 text-gray-800`, rounded-lg
- **Loading indicator**: Animated dots (`...`) in an AI-styled bubble while waiting
- **Empty state**: "Ask me anything about the papers in this workspace!"

### SearchBar.jsx
- **Props**: `onSearch` (function), `placeholder` (string, default "Search papers...")
- **Behavior**: Debounce input by 300ms before calling `onSearch(value)`
- **Layout**: Input with Search icon (lucide-react) on left, clear button (X icon) on right when text present
- **Styling**: Full width, rounded-full or rounded-lg, border, focus ring

### FileUpload.jsx
- **Props**: `onFileSelect` (function), `accept` (string, default ".pdf")
- **Layout**: Dashed border box (drop zone), centered content
- **Content**: Upload icon, "Click or drag file to upload", accepted file types note
- **Drag-and-drop**: Handle `onDragOver`, `onDragLeave`, `onDrop` events, change border color on drag-over
- **Click**: Hidden `<input type="file">`, triggered by clicking the zone
- **After selection**: Display selected file name + size, option to remove
- **Styling**: Dashed border, rounded-lg, hover:bg-gray-50, drag-over:border-blue-500

### Sidebar.jsx
- **Props**: `workspaces` (array), `activeId` (number)
- **Layout**: Vertical list of workspace names
- **Each item**: Workspace name, click → `navigate('/workspace/${id}')`
- **Active**: Highlighted with blue bg
- **Footer**: "Create New Workspace" button
- **Styling**: Fixed left sidebar on desktop, hidden or drawer on mobile

---

## Color Scheme (Tailwind Classes)

| Element | Class |
|---------|-------|
| Primary buttons | `bg-blue-600 hover:bg-blue-700 text-white` |
| Secondary buttons | `bg-gray-200 hover:bg-gray-300 text-gray-800` |
| Danger buttons | `bg-red-500 hover:bg-red-600 text-white` |
| Page background | `bg-gray-50` |
| Cards | `bg-white rounded-lg shadow-md` |
| Headings | `text-gray-900 font-bold` |
| Body text | `text-gray-600` |
| Muted text | `text-gray-400` |
| Chat user bubble | `bg-blue-500 text-white` |
| Chat AI bubble | `bg-gray-100 text-gray-800` |
| Active nav link | `text-blue-600 border-b-2 border-blue-600` |
| Success states | `text-green-600` or `bg-green-100` |
| Error states | `text-red-600` or `bg-red-100` |
| Input focus | `focus:ring-2 focus:ring-blue-500 focus:border-blue-500` |

---

## Key Setup Files

### vite.config.js
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173
  }
});
```

### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### src/index.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### src/main.jsx
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Running the Frontend

```bash
cd ResearchHub-AI/frontend
npm install
npm run dev
```

Dev server: http://localhost:5173

**Backend dependency**: The backend must be running at `http://localhost:8000` for API calls to work. Start it first.

---

## Implementation Order

Follow this sequence for clean dependency resolution:

1. `src/utils/api.js`
2. `src/utils/AuthContext.jsx`
3. `src/components/ProtectedRoute.jsx`
4. `src/components/Navbar.jsx`
5. `src/pages/LoginPage.jsx` → `src/pages/RegisterPage.jsx` → `src/pages/HomePage.jsx`
6. `src/components/PaperCard.jsx` → `src/components/SearchBar.jsx`
7. `src/pages/SearchPage.jsx`
8. `src/pages/WorkspacesPage.jsx`
9. `src/components/ChatInterface.jsx` → `src/pages/WorkspaceDetailPage.jsx`
10. `src/components/FileUpload.jsx` → `src/pages/UploadPage.jsx`
11. `src/pages/AIToolsPage.jsx`
12. `src/pages/DocSpacePage.jsx`
13. `src/pages/DashboardPage.jsx`
14. `src/App.jsx` (finalize all routes)
15. `src/main.jsx`

---

## Testing Checklist

- [ ] Login page renders, form validates, login works with valid credentials
- [ ] Register page creates account, redirects to login
- [ ] Navbar shows correct links based on auth state
- [ ] Dashboard loads and displays stats
- [ ] Search returns results from backend, papers display correctly
- [ ] Import paper to workspace works (modal → select workspace → confirm)
- [ ] Workspaces page lists workspaces, create workspace works
- [ ] Workspace detail shows papers on left, chat on right
- [ ] Chat sends messages, receives AI responses, auto-scrolls
- [ ] AI Tools page: select workspace, papers, run tools, see results
- [ ] Upload PDF works with workspace selection
- [ ] Doc Space shows all papers across all workspaces
- [ ] Protected routes redirect to login when not authenticated
- [ ] Logout clears state and redirects to home
- [ ] Toast notifications appear for success/error states
