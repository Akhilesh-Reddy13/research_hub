import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2, Loader2, FileText, CheckSquare, Square, Film } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const tools = [
  { id: 'summarize', label: 'Summarize', desc: 'Get a concise summary of selected papers', min: 1 },
  { id: 'compare', label: 'Compare Papers', desc: 'Find similarities & differences', min: 2 },
  { id: 'findings', label: 'Key Findings', desc: 'Extract main findings', min: 1 },
];

export default function AIToolsPage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState('');
  const [papers, setPapers] = useState([]);
  const [selectedPapers, setSelectedPapers] = useState([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [result, setResult] = useState('');
  const [processing, setProcessing] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    const loadWs = async () => {
      try {
        const res = await api.get('/workspaces');
        setWorkspaces(res.data.workspaces || []);
      } catch {
        toast.error('Failed to load workspaces');
      }
    };
    loadWs();
  }, []);

  useEffect(() => {
    if (!selectedWs) {
      setPapers([]);
      setSelectedPapers([]);
      return;
    }
    const loadPapers = async () => {
      setLoadingPapers(true);
      try {
        const res = await api.get(`/papers/workspace/${selectedWs}`);
        setPapers(res.data.papers || []);
        setSelectedPapers([]);
      } catch {
        toast.error('Failed to load papers');
      } finally {
        setLoadingPapers(false);
      }
    };
    loadPapers();
  }, [selectedWs]);

  const togglePaper = (paperId) => {
    setSelectedPapers((prev) =>
      prev.includes(paperId) ? prev.filter((id) => id !== paperId) : [...prev, paperId]
    );
  };

  const runTool = async (toolId) => {
    const tool = tools.find((t) => t.id === toolId);
    if (selectedPapers.length < tool.min) {
      toast.error(`Select at least ${tool.min} paper(s)`);
      return;
    }

    setProcessing(true);
    setResult('');
    try {
      const res = await api.post('/chat/tool', {
        tool: toolId,
        paper_ids: selectedPapers,
        workspace_id: parseInt(selectedWs),
      });
      setResult(res.data.response);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'AI processing failed');
    } finally {
      setProcessing(false);
      // Cooldown to prevent rapid-fire requests that hit rate limits
      setCooldown(true);
      setTimeout(() => setCooldown(false), 5000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Wand2 size={28} className="text-purple-600" />
        <h1 className="text-2xl font-bold text-gray-900">AI Tools</h1>
      </div>

      {/* Storyboard Generator CTA */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-5 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Film size={24} />
            <div>
              <h2 className="text-lg font-semibold">Research Visual Summary</h2>
              <p className="text-purple-100 text-sm">
                Generate an academic visual summary with architecture diagrams, flowcharts &amp; downloadable PDF
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/storyboard')}
            className="px-5 py-2.5 bg-white text-purple-700 rounded-lg font-semibold text-sm hover:bg-purple-50 transition-colors shadow"
          >
            Generate Visual Summary →
          </button>
        </div>
      </div>

      {/* Step 1: Select workspace */}
      <div className="bg-white rounded-xl shadow-md p-5 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          1. Select Workspace
        </label>
        <select
          value={selectedWs}
          onChange={(e) => setSelectedWs(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Choose a workspace...</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name} ({ws.paper_count || 0} papers)
            </option>
          ))}
        </select>
      </div>

      {/* Step 2: Select papers */}
      {selectedWs && (
        <div className="bg-white rounded-xl shadow-md p-5 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            2. Select Papers
          </label>
          {loadingPapers ? (
            <Loader2 size={20} className="animate-spin text-blue-600" />
          ) : papers.length === 0 ? (
            <p className="text-sm text-gray-400">No papers in this workspace</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {papers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePaper(p.id)}
                  className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {selectedPapers.includes(p.id) ? (
                    <CheckSquare size={18} className="text-blue-600 flex-shrink-0" />
                  ) : (
                    <Square size={18} className="text-gray-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400 truncate">{p.authors || ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Run tools */}
      {selectedPapers.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-5 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            3. Choose Tool ({selectedPapers.length} paper{selectedPapers.length > 1 ? 's' : ''} selected)
          </label>
          <div className="flex flex-wrap gap-3">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => runTool(tool.id)}
                disabled={processing || cooldown}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {(processing || result) && (
        <div className="bg-white rounded-xl shadow-md p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Results</h3>
          {processing ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Analyzing papers...</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {result}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
