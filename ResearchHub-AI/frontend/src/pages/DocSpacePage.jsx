import { useState, useEffect } from 'react';
import { FileText, Loader2, Sparkles, Type } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import PaperCard from '../components/PaperCard';
import SearchBar from '../components/SearchBar';

export default function DocSpacePage() {
  const [workspaces, setWorkspaces] = useState([]);
  const [allPapers, setAllPapers] = useState([]);
  const [filteredPapers, setFilteredPapers] = useState([]);
  const [selectedWs, setSelectedWs] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [isHybridResult, setIsHybridResult] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const wsRes = await api.get('/workspaces');
        const wsList = wsRes.data.workspaces || [];
        setWorkspaces(wsList);

        let papers = [];
        for (const ws of wsList) {
          try {
            const pRes = await api.get(`/papers/workspace/${ws.id}`);
            const wsPapers = (pRes.data.papers || []).map((p) => ({
              ...p,
              workspace_name: ws.name,
            }));
            papers = [...papers, ...wsPapers];
          } catch {
            // skip
          }
        }
        setAllPapers(papers);
        setFilteredPapers(papers);
      } catch {
        toast.error('Failed to load documents');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Hybrid search when search term changes
  useEffect(() => {
    const runSearch = async () => {
      if (!searchTerm.trim()) {
        // No search — show all papers (filtered by workspace)
        let filtered = allPapers;
        if (selectedWs !== 'all') {
          filtered = filtered.filter((p) => String(p.workspace_id) === selectedWs);
        }
        setFilteredPapers(filtered);
        setIsHybridResult(false);
        return;
      }

      setSearching(true);
      try {
        const params = { query: searchTerm };
        if (selectedWs !== 'all') {
          params.workspace_id = selectedWs;
        }
        const res = await api.get('/papers/search/hybrid', { params });
        const results = (res.data.papers || []).map((p) => {
          // Attach workspace_name from our cached list
          const ws = workspaces.find((w) => w.id === p.workspace_id);
          return { ...p, workspace_name: ws?.name || '' };
        });
        setFilteredPapers(results);
        setIsHybridResult(true);
      } catch {
        // Fallback to client-side filter
        let filtered = allPapers;
        if (selectedWs !== 'all') {
          filtered = filtered.filter((p) => String(p.workspace_id) === selectedWs);
        }
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.title?.toLowerCase().includes(term) ||
            p.authors?.toLowerCase().includes(term)
        );
        setFilteredPapers(filtered);
        setIsHybridResult(false);
      } finally {
        setSearching(false);
      }
    };
    runSearch();
  }, [selectedWs, searchTerm, allPapers, workspaces]);

  const handleDeletePaper = async (paper) => {
    if (!confirm('Delete this paper?')) return;
    try {
      await api.delete(`/papers/${paper.id}`);
      toast.success('Paper deleted');
      setAllPapers((prev) => prev.filter((p) => p.id !== paper.id));
    } catch {
      toast.error('Failed to delete paper');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={28} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Doc Space</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={selectedWs}
          onChange={(e) => setSelectedWs(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Workspaces</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
        <SearchBar
          onSearch={setSearchTerm}
          placeholder="Search papers (semantic + keyword)..."
        />
      </div>

      {/* Search info */}
      {isHybridResult && searchTerm.trim() && (
        <div className="flex items-center gap-2 mb-4 px-1">
          <span className="text-sm text-gray-500">
            {filteredPapers.length} result{filteredPapers.length !== 1 ? 's' : ''} ranked by relevance
          </span>
          <span className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
            <Sparkles size={10} /> Semantic
          </span>
          <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
            <Type size={10} /> Keyword
          </span>
        </div>
      )}

      {/* Papers grid */}
      {searching ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-600 mr-2" />
          <span className="text-gray-500">Searching...</span>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No documents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPapers.map((paper) => (
            <div key={paper.id} className="relative">
              {isHybridResult && paper.relevance_score != null && (
                <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full shadow-sm ${
                      paper.relevance_score >= 0.5
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : paper.relevance_score >= 0.2
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                          : 'bg-gray-100 text-gray-600 border border-gray-300'
                    }`}
                    title={`Keyword: ${(paper.keyword_score * 100).toFixed(0)}% | Semantic: ${(paper.semantic_score * 100).toFixed(0)}%`}
                  >
                    {(paper.relevance_score * 100).toFixed(0)}% match
                  </span>
                </div>
              )}
              <PaperCard
                paper={paper}
                showDelete
                onDelete={handleDeletePaper}
                workspaceName={paper.workspace_name}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
