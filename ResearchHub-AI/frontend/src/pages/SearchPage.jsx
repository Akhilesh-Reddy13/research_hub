import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import PaperCard from '../components/PaperCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [importModal, setImportModal] = useState(null); // paper being imported
  const [selectedWs, setSelectedWs] = useState('');

  // Load workspaces for the import flow
  useEffect(() => {
    const loadWs = async () => {
      try {
        const res = await api.get('/workspaces');
        setWorkspaces(res.data.workspaces || []);
      } catch {
        // non-critical
      }
    };
    loadWs();
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get('/papers/search', { params: { query: query.trim() } });
      setPapers(res.data.papers || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedWs || !importModal) return;
    try {
      await api.post('/papers/import', {
        ...importModal,
        workspace_id: parseInt(selectedWs),
      });
      toast.success('Paper imported!');
      setImportModal(null);
      setSelectedWs('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Search Papers</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-8 max-w-2xl">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search academic papers..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Search'}
        </button>
      </form>

      {/* Results */}
      {!searched && !loading && (
        <p className="text-gray-400 text-center mt-16">Enter a search term to find papers</p>
      )}

      {loading && (
        <div className="flex justify-center mt-16">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      )}

      {searched && !loading && papers.length === 0 && (
        <p className="text-gray-400 text-center mt-16">No papers found for "{query}"</p>
      )}

      {!loading && papers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {papers.map((paper, idx) => (
            <PaperCard
              key={idx}
              paper={paper}
              showImport
              onImport={(p) => setImportModal(p)}
            />
          ))}
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Import Paper</h3>
            <p className="text-sm text-gray-500 mb-4 truncate">{importModal.title}</p>

            {workspaces.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">
                No workspaces found. Create one first from the Workspaces page.
              </p>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Workspace
                </label>
                <select
                  value={selectedWs}
                  onChange={(e) => setSelectedWs(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a workspace...</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setImportModal(null);
                  setSelectedWs('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!selectedWs}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
