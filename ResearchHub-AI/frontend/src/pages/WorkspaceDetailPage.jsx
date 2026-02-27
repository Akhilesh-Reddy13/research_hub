import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import ChatInterface from '../components/ChatInterface';
import PaperCard from '../components/PaperCard';

export default function WorkspaceDetailPage() {
  const { id } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [wsRes, papersRes] = await Promise.all([
        api.get(`/workspaces/${id}`),
        api.get(`/papers/workspace/${id}`),
      ]);
      setWorkspace(wsRes.data);
      setPapers(papersRes.data.papers || []);
    } catch (err) {
      toast.error('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleDeletePaper = async (paper) => {
    if (!confirm('Delete this paper?')) return;
    try {
      await api.delete(`/papers/${paper.id}`);
      toast.success('Paper deleted');
      setPapers((prev) => prev.filter((p) => p.id !== paper.id));
    } catch (err) {
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

  if (!workspace) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Workspace not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
        {workspace.description && (
          <p className="text-sm text-gray-500 mt-1">{workspace.description}</p>
        )}
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" style={{ minHeight: '70vh' }}>
        {/* Left panel — Papers */}
        <div className="lg:col-span-2 space-y-3 overflow-y-auto max-h-[75vh] pr-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Papers ({papers.length})
          </h2>
          {papers.length === 0 ? (
            <p className="text-sm text-gray-400">
              No papers yet. Search and import papers to this workspace.
            </p>
          ) : (
            papers.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                showDelete
                onDelete={handleDeletePaper}
              />
            ))
          )}
        </div>

        {/* Right panel — Chat */}
        <div className="lg:col-span-3 h-[75vh]">
          <ChatInterface workspaceId={parseInt(id)} />
        </div>
      </div>
    </div>
  );
}
