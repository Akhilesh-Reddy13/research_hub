import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus } from 'lucide-react';

export default function Sidebar({ workspaces, activeId, onCreateClick }) {
  const navigate = useNavigate();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Workspaces
      </h3>

      <div className="space-y-1">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => navigate(`/workspace/${ws.id}`)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
              activeId === ws.id
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FolderOpen size={16} />
            <span className="truncate">{ws.name}</span>
          </button>
        ))}
      </div>

      {workspaces.length === 0 && (
        <p className="text-sm text-gray-400 mt-2">No workspaces yet</p>
      )}

      <button
        onClick={onCreateClick}
        className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <Plus size={16} />
        New Workspace
      </button>
    </aside>
  );
}
