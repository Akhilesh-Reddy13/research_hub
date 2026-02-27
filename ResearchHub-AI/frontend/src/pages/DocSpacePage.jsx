import { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    let filtered = allPapers;

    if (selectedWs !== 'all') {
      filtered = filtered.filter((p) => String(p.workspace_id) === selectedWs);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(term) ||
          p.authors?.toLowerCase().includes(term)
      );
    }

    setFilteredPapers(filtered);
  }, [selectedWs, searchTerm, allPapers]);

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
          placeholder="Filter by title or author..."
        />
      </div>

      {/* Papers grid */}
      {filteredPapers.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No documents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              showDelete
              onDelete={handleDeletePaper}
              workspaceName={paper.workspace_name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
