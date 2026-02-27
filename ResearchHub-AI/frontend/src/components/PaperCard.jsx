import { User, Calendar, ExternalLink } from 'lucide-react';

export default function PaperCard({
  paper,
  onImport,
  onDelete,
  showImport = false,
  showDelete = false,
  workspaceName,
}) {
  const truncatedAbstract =
    paper.abstract && paper.abstract.length > 200
      ? paper.abstract.slice(0, 200) + '...'
      : paper.abstract;

  return (
    <div className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow">
      {workspaceName && (
        <span className="inline-block text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded mb-2">
          {workspaceName}
        </span>
      )}

      <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
        {paper.title || 'Untitled'}
      </h3>

      {paper.authors && (
        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
          <User size={14} />
          <span className="truncate">{paper.authors}</span>
        </div>
      )}

      {paper.published_date && (
        <div className="flex items-center gap-1 text-sm text-gray-400 mb-2">
          <Calendar size={14} />
          <span>{paper.published_date}</span>
        </div>
      )}

      {truncatedAbstract && (
        <p className="text-sm text-gray-600 mb-3 leading-relaxed">
          {truncatedAbstract}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink size={12} />
            View Paper
          </a>
        )}

        {showImport && onImport && (
          <button
            onClick={() => onImport(paper)}
            className="ml-auto text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Import
          </button>
        )}

        {showDelete && onDelete && (
          <button
            onClick={() => onDelete(paper)}
            className="ml-auto text-sm bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
