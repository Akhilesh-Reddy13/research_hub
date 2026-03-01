import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCode2, FolderOpen, Loader2, ArrowRight } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function LatexLandingPage() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/workspaces');
        setWorkspaces(res.data.workspaces || []);
      } catch {
        toast.error('Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-28 pb-16">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 mb-4">
          <FileCode2 size={32} className="text-emerald-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">LaTeX Research Editor</h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Write, compile, and preview LaTeX papers directly inside ResearchHub. Select a workspace to get started.
        </p>
      </div>

      {/* Workspace grid */}
      {workspaces.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No workspaces yet. Create one from the Workspaces page first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => navigate(`/latex/${ws.id}`)}
              className="group bg-white rounded-xl shadow-md p-5 text-left hover:shadow-lg hover:border-emerald-300 border border-gray-200 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                  <FolderOpen size={20} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                    {ws.name}
                  </h3>
                  {ws.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{ws.description}</p>
                  )}
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-emerald-500 mt-1 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
