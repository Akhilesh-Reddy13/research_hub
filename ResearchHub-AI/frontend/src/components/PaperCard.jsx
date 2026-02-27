import { useState } from 'react';
import { User, Calendar, ExternalLink, Eye, Download, X } from 'lucide-react';
import api from '../utils/api';

export default function PaperCard({
  paper,
  onImport,
  onDelete,
  showImport = false,
  showDelete = false,
  workspaceName,
}) {
  const [previewUrl, setPreviewUrl] = useState(null);

  const truncatedAbstract =
    paper.abstract && paper.abstract.length > 200
      ? paper.abstract.slice(0, 200) + '...'
      : paper.abstract;

  const handlePreview = async () => {
    // For saved papers with PDF data, fetch from our API
    if (paper.id && paper.has_pdf) {
      try {
        const res = await api.get(`/papers/${paper.id}/pdf`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch {
        // fallback to external URL
        if (paper.url) window.open(paper.url, '_blank');
      }
    } else if (paper.pdf_url) {
      // Search results – open OA PDF directly
      window.open(paper.pdf_url, '_blank');
    } else if (paper.url) {
      window.open(paper.url, '_blank');
    }
  };

  const handleDownload = async () => {
    if (paper.id && paper.has_pdf) {
      try {
        const res = await api.get(`/papers/${paper.id}/download`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${paper.title || 'paper'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        if (paper.url) window.open(paper.url, '_blank');
      }
    } else if (paper.pdf_url) {
      window.open(paper.pdf_url, '_blank');
    } else if (paper.url) {
      window.open(paper.url, '_blank');
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  return (
    <>
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
          {/* Preview button – shown when we have a stored PDF or an OA link */}
          {(paper.has_pdf || paper.pdf_url || paper.url) && (
            <button
              onClick={handlePreview}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
              title="Preview PDF"
            >
              <Eye size={14} />
              Preview
            </button>
          )}

          {/* Download button */}
          {(paper.has_pdf || paper.pdf_url) && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded transition-colors"
              title="Download PDF"
            >
              <Download size={14} />
              Download
            </button>
          )}

          {/* External link – always show if URL exists */}
          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            >
              <ExternalLink size={12} />
              Source
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

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 truncate">
                {paper.title || 'PDF Preview'}
              </h3>
              <button
                onClick={closePreview}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <iframe
              src={previewUrl}
              className="flex-1 w-full"
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </>
  );
}
