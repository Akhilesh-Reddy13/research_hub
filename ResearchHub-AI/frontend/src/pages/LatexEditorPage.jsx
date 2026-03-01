import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Play,
  Download,
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCode2,
  LayoutTemplate,
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

/* ================================================================
   Integrated LaTeX Research Editor  (Overleaf-style)
   ================================================================ */

export default function LatexEditorPage() {
  const { id: workspaceId } = useParams();
  const navigate = useNavigate();

  // ── state ──────────────────────────────
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState('main.tex');
  const [code, setCode] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState(null);   // {success, logs}
  const [pdfUrl, setPdfUrl] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);

  const saveTimerRef = useRef(null);
  const iframeRef = useRef(null);

  // ── helpers ────────────────────────────
  const token = localStorage.getItem('token');

  const pdfDownloadUrl = pdfUrl
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/latex/pdf/${workspaceId}`
    : null;

  // Build an authenticated URL for the iframe
  const buildPdfPreviewUrl = useCallback(() => {
    if (!pdfUrl) return null;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    // We'll fetch the PDF as a blob and use object URL for the iframe
    return `${base}/latex/pdf/${workspaceId}`;
  }, [pdfUrl, workspaceId]);

  // ── load initial data ──────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [fileRes, contentRes, tplRes] = await Promise.all([
          api.get(`/latex/files/${workspaceId}`),
          api.get(`/latex/file/${workspaceId}?name=main.tex`),
          api.get('/latex/templates'),
        ]);
        setFiles(fileRes.data.files || []);
        setCode(contentRes.data.content || '');
        setTemplates(tplRes.data.templates || []);

        // Check if a compiled PDF already exists
        try {
          const headRes = await api.get(`/latex/pdf/${workspaceId}`, { responseType: 'blob' });
          if (headRes.status === 200) {
            const blob = new Blob([headRes.data], { type: 'application/pdf' });
            setPdfUrl(URL.createObjectURL(blob));
          }
        } catch {
          // no compiled PDF yet — fine
        }
      } catch {
        toast.error('Failed to load LaTeX project');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [workspaceId]);

  // ── auto-save (debounced 2s) ───────────
  useEffect(() => {
    if (!dirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 2000);
    return () => clearTimeout(saveTimerRef.current);
  }, [code, dirty]);

  // ── actions ────────────────────────────

  const handleSave = async (silent = false) => {
    setSaving(true);
    try {
      await api.post(`/latex/file/${workspaceId}`, {
        filename: activeFile,
        content: code,
      });
      setDirty(false);
      if (!silent) toast.success('Saved');
      // refresh file tree
      const res = await api.get(`/latex/files/${workspaceId}`);
      setFiles(res.data.files || []);
    } catch {
      if (!silent) toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCompile = async () => {
    // Save first
    await handleSave(true);
    setCompiling(true);
    setCompileResult(null);
    try {
      const res = await api.post(`/latex/compile/${workspaceId}`, {}, { timeout: 120000 });
      setCompileResult({ success: res.data.success, logs: res.data.logs });
      if (res.data.success) {
        toast.success('Compiled successfully!');
        // Fetch fresh PDF blob for preview
        try {
          const pdfRes = await api.get(`/latex/pdf/${workspaceId}`, { responseType: 'blob' });
          const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
          // Revoke old URL
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          setPdfUrl(URL.createObjectURL(blob));
        } catch {
          toast.error('Compiled but failed to load PDF preview');
        }
      } else {
        toast.error('Compilation failed — check logs');
        setShowLogs(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Compilation failed');
    } finally {
      setCompiling(false);
    }
  };

  const handleFileSelect = async (filename) => {
    if (dirty) await handleSave(true);
    try {
      const res = await api.get(`/latex/file/${workspaceId}?name=${encodeURIComponent(filename)}`);
      setCode(res.data.content || '');
      setActiveFile(filename);
      setDirty(false);
    } catch {
      toast.error('Failed to open file');
    }
  };

  const handleCreateFile = async () => {
    const name = newFileName.trim();
    if (!name) return;
    try {
      await api.post(`/latex/file/${workspaceId}`, { filename: name, content: '' });
      toast.success('File created');
      setShowNewFile(false);
      setNewFileName('');
      const res = await api.get(`/latex/files/${workspaceId}`);
      setFiles(res.data.files || []);
      handleFileSelect(name);
    } catch {
      toast.error('Failed to create file');
    }
  };

  const handleDeleteFile = async (filename) => {
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      await api.delete(`/latex/file/${workspaceId}?name=${encodeURIComponent(filename)}`);
      toast.success('Deleted');
      const res = await api.get(`/latex/files/${workspaceId}`);
      setFiles(res.data.files || []);
      if (activeFile === filename) {
        setActiveFile('main.tex');
        const c = await api.get(`/latex/file/${workspaceId}?name=main.tex`);
        setCode(c.data.content || '');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const handleApplyTemplate = async (tpl) => {
    if (!confirm(`Apply "${tpl}" template? This will overwrite main.tex.`)) return;
    try {
      const res = await api.post(`/latex/template/${workspaceId}`, { template: tpl });
      setCode(res.data.content);
      setActiveFile('main.tex');
      setDirty(false);
      setShowTemplates(false);
      toast.success(`Template "${tpl}" applied`);
      const fr = await api.get(`/latex/files/${workspaceId}`);
      setFiles(fr.data.files || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply template');
    }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(`/latex/pdf/${workspaceId}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'paper.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed — compile first');
    }
  };

  // ── loading state ──────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <Loader2 size={32} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  // ── render ─────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 pt-20">
      {/* ─── Top Bar ─── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/workspace/${workspaceId}`)}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Back to workspace"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <FileCode2 size={20} className="text-emerald-400" />
            <span className="font-semibold text-sm">LaTeX Editor</span>
          </div>
          {dirty && (
            <span className="text-xs text-amber-400 ml-2">● unsaved</span>
          )}
          {saving && (
            <span className="text-xs text-gray-400 ml-2 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> saving…
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Template picker */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              <LayoutTemplate size={14} /> Templates
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-600 rounded-xl shadow-xl z-50 overflow-hidden">
                {templates.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleApplyTemplate(t)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors capitalize"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compile */}
          <button
            onClick={handleCompile}
            disabled={compiling}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {compiling ? (
              <><Loader2 size={14} className="animate-spin" /> Compiling…</>
            ) : (
              <><Play size={14} /> Compile</>
            )}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={!pdfUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={14} /> PDF
          </button>

          {/* Logs toggle */}
          {compileResult && (
            <button
              onClick={() => setShowLogs(!showLogs)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                compileResult.success
                  ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900/80'
                  : 'bg-red-900/50 text-red-400 hover:bg-red-900/80'
              }`}
            >
              {compileResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              Logs
            </button>
          )}
        </div>
      </div>

      {/* ─── Main 3-panel layout ─── */}
      <div className="flex flex-1 min-h-0">
        {/* ─── Left Panel: File Tree ─── */}
        <div className="w-56 flex-shrink-0 bg-gray-850 border-r border-gray-700 flex flex-col" style={{ background: '#1a1d23' }}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Files</span>
            <button
              onClick={() => setShowNewFile(!showNewFile)}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="New file"
            >
              <Plus size={14} />
            </button>
          </div>

          {showNewFile && (
            <div className="px-3 py-2 border-b border-gray-700 flex gap-1">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                placeholder="filename.tex"
                className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
              <button onClick={handleCreateFile} className="px-2 py-1 text-xs bg-emerald-600 rounded text-white hover:bg-emerald-700">
                Add
              </button>
              <button onClick={() => { setShowNewFile(false); setNewFileName(''); }} className="px-1.5 py-1 text-xs text-gray-400 hover:text-white">
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-1">
            {files.length === 0 ? (
              <p className="text-xs text-gray-500 px-3 py-4 text-center">No files yet</p>
            ) : (
              files.map((f) => (
                <div
                  key={f.name}
                  className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                    activeFile === f.name
                      ? 'bg-gray-700/60 text-emerald-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                  onClick={() => handleFileSelect(f.name)}
                >
                  <FileText size={14} className="flex-shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  {f.name !== 'main.tex' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.name); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Center Panel: Code Editor ─── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* File tab */}
          <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-700 rounded text-xs text-gray-200">
              <FileText size={12} className="text-emerald-400" />
              {activeFile}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              defaultLanguage="latex"
              language="latex"
              theme="vs-dark"
              value={code}
              onChange={(val) => {
                setCode(val || '');
                setDirty(true);
              }}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                minimap: { enabled: false },
                wordWrap: 'on',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                renderWhitespace: 'none',
                padding: { top: 12 },
              }}
            />
          </div>
        </div>

        {/* ─── Right Panel: PDF Preview ─── */}
        <div className="w-[45%] flex-shrink-0 flex flex-col border-l border-gray-700 bg-gray-800">
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-700">
            <FileText size={14} className="text-blue-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">PDF Preview</span>
          </div>
          <div className="flex-1 min-h-0 bg-gray-200">
            {pdfUrl ? (
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                title="PDF Preview"
                className="w-full h-full border-0"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                <FileText size={48} className="text-gray-400" />
                <p className="text-sm font-medium">No PDF yet</p>
                <p className="text-xs text-gray-400">Click <span className="text-emerald-500 font-semibold">Compile</span> to generate your PDF</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Compile Logs Panel (slide-up) ─── */}
      {showLogs && compileResult && (
        <div className="flex-shrink-0 bg-gray-900 border-t border-gray-700" style={{ maxHeight: '30vh' }}>
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              {compileResult.success ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <AlertTriangle size={14} className="text-red-400" />
              )}
              <span className="text-xs font-semibold text-gray-300">
                Compiler Output {compileResult.success ? '(Success)' : '(Error)'}
              </span>
            </div>
            <button
              onClick={() => setShowLogs(false)}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <pre className="overflow-auto p-4 text-xs text-gray-400 font-mono leading-relaxed" style={{ maxHeight: 'calc(30vh - 36px)' }}>
            {compileResult.logs || 'No output.'}
          </pre>
        </div>
      )}
    </div>
  );
}
