import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Trash2, Headphones, Download } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import ChatInterface from '../components/ChatInterface';
import PaperCard from '../components/PaperCard';

export default function WorkspaceDetailPage() {
  const { id } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

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

  const handleGenerateAudio = async () => {
    setAudioLoading(true);
    setAudioUrl(null);
    try {
      const res = await api.post(`/audio/generate/${id}`, {}, { timeout: 120000 });
      setAudioUrl(`http://localhost:8000${res.data.audio_url}`);
      toast.success('Audio summary generated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Audio generation failed');
    } finally {
      setAudioLoading(false);
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
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
          {workspace.description && (
            <p className="text-sm text-gray-500 mt-1">{workspace.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateAudio}
            disabled={audioLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {audioLoading ? (
              <><Loader2 size={16} className="animate-spin" /> Generating...</>
            ) : (
              <><Headphones size={16} /> Audio Summary</>
            )}
          </button>
        </div>
      </div>

      {/* Audio Player */}
      {audioUrl && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-4 flex-wrap">
          <Headphones size={20} className="text-emerald-600 flex-shrink-0" />
          <audio controls src={audioUrl} className="flex-1 min-w-[200px]" />
          <a
            href={audioUrl}
            download
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-colors"
          >
            <Download size={14} /> Download
          </a>
        </div>
      )}

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
          <ChatInterface workspaceId={parseInt(id)} papers={papers} />
        </div>
      </div>
    </div>
  );
}
