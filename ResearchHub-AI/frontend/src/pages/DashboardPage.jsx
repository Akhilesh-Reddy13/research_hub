import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, FolderOpen, MessageSquare, Search, Wand2, Upload } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState([]);
  const [totalPapers, setTotalPapers] = useState(0);
  const [recentPapers, setRecentPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const wsRes = await api.get('/workspaces');
        const wsList = wsRes.data.workspaces || [];
        setWorkspaces(wsList);

        // Count total papers and gather recent ones
        let allPapers = [];
        const paperCount = wsList.reduce((sum, ws) => sum + (ws.paper_count || 0), 0);
        setTotalPapers(paperCount);

        // Fetch papers from first few workspaces for recent list
        for (const ws of wsList.slice(0, 5)) {
          try {
            const pRes = await api.get(`/papers/workspace/${ws.id}`);
            const papers = (pRes.data.papers || []).map((p) => ({
              ...p,
              workspace_name: ws.name,
            }));
            allPapers = [...allPapers, ...papers];
          } catch {
            // skip
          }
        }

        // Sort by imported_at descending and take 5
        allPapers.sort((a, b) => new Date(b.imported_at) - new Date(a.imported_at));
        setRecentPapers(allPapers.slice(0, 5));
      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Papers', value: totalPapers, icon: FileText, color: 'blue' },
    { label: 'Workspaces', value: workspaces.length, icon: FolderOpen, color: 'green' },
    { label: 'Conversations', value: '—', icon: MessageSquare, color: 'purple' },
  ];

  const quickLinks = [
    { to: '/search', label: 'Search Papers', icon: Search, color: 'bg-blue-500' },
    { to: '/workspaces', label: 'Workspaces', icon: FolderOpen, color: 'bg-green-500' },
    { to: '/ai-tools', label: 'AI Tools', icon: Wand2, color: 'bg-purple-500' },
    { to: '/upload', label: 'Upload PDF', icon: Upload, color: 'bg-orange-500' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-md p-5 flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-${s.color}-100`}>
              <s.icon size={24} className={`text-${s.color}-600`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {quickLinks.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="bg-white rounded-xl shadow-md p-4 text-center hover:shadow-lg transition-shadow"
          >
            <div className={`inline-flex p-3 rounded-full ${q.color} text-white mb-2`}>
              <q.icon size={20} />
            </div>
            <p className="text-sm font-medium text-gray-700">{q.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent Papers */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Papers</h2>
        {recentPapers.length === 0 ? (
          <p className="text-sm text-gray-400">
            No papers yet.{' '}
            <Link to="/search" className="text-blue-600 hover:underline">
              Search and import some papers
            </Link>
            .
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentPapers.map((p) => (
              <div key={p.id} className="py-3 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.title}</p>
                  <p className="text-xs text-gray-400">
                    {p.workspace_name && (
                      <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded mr-2">
                        {p.workspace_name}
                      </span>
                    )}
                    {p.authors && <span>{p.authors}</span>}
                  </p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                  {p.published_date || ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
