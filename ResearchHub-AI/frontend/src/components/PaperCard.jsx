import { useState } from 'react';
import { User, Calendar, Eye, Download, X, FileText, Loader2, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function PaperCard({
  paper,
  onImport,
  onDelete,
  showImport = false,
  showDelete = false,
  workspaceName,
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [contentPreview, setContentPreview] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const truncatedAbstract =
    paper.abstract && paper.abstract.length > 200
      ? paper.abstract.slice(0, 200) + '...'
      : paper.abstract;

  const handlePreview = async () => {
    setPreviewError(false);
    setPreviewLoading(true);

    // For saved papers with PDF data, fetch from our API
    if (paper.id && paper.has_pdf) {
      try {
        const res = await api.get(`/papers/${paper.id}/pdf`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewLoading(false);
        return;
      } catch {
        // fall through to proxy
      }
    }

    // For search results or imported papers without stored PDF – use the backend proxy
    if (paper.pdf_url || paper.doi || paper.url) {
      try {
        const res = await api.post('/papers/proxy-pdf', {
          pdf_url: paper.pdf_url || '',
          url: paper.url || '',
          doi: paper.doi || '',
        }, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewLoading(false);
        return;
      } catch {
        // proxy failed – show abstract fallback
      }
    }

    // No PDF available – fetch content preview from backend for saved papers
    if (paper.id) {
      try {
        const res = await api.get(`/papers/${paper.id}/preview`);
        setContentPreview(res.data);
      } catch {
        // ignore – will show with whatever we have
      }
    }

    setPreviewError(true);
    setPreviewUrl('abstract');
    setPreviewLoading(false);
  };

  const handleDownload = async () => {
    setDownloadLoading(true);
    const filename = `${paper.title || 'paper'}.pdf`;

    // 1. Saved papers with stored PDF
    if (paper.id && paper.has_pdf) {
      try {
        const res = await api.get(`/papers/${paper.id}/download`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setDownloadLoading(false);
        return;
      } catch {
        // fall through to proxy
      }
    }

    // 2. Try proxy for search results or papers without stored PDF
    if (paper.pdf_url || paper.doi || paper.url) {
      try {
        const res = await api.post('/papers/proxy-pdf', {
          pdf_url: paper.pdf_url || '',
          url: paper.url || '',
          doi: paper.doi || '',
        }, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setDownloadLoading(false);
        return;
      } catch {
        // proxy also failed
      }
    }

    // 3. Nothing worked
    toast.error('Download not available — PDF could not be fetched for this paper.');
    setDownloadLoading(false);
  };

  const closePreview = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewError(false);
    setPreviewLoading(false);
    setContentPreview(null);
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
          {/* Preview button – always shown so user can at least see the abstract */}
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
            title="Preview Paper"
          >
            {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            Preview
          </button>

          {/* Download button – always shown, will notify if not available */}
          <button
            onClick={handleDownload}
            disabled={downloadLoading}
            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
            title="Download PDF"
          >
            {downloadLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download
          </button>

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

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 truncate max-w-[70%]">
                {paper.title || 'Paper Preview'}
              </h3>
              <button
                onClick={closePreview}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {previewUrl === 'abstract' ? (
              /* Text-based fallback preview */
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto">
                  {previewError && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-sm">
                      <AlertCircle size={16} />
                      PDF preview not available. Showing extracted content instead.
                    </div>
                  )}

                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {contentPreview?.title || paper.title}
                  </h2>

                  {(contentPreview?.authors || paper.authors) && (
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <User size={16} />
                      <span className="text-sm">{contentPreview?.authors || paper.authors}</span>
                    </div>
                  )}

                  {(contentPreview?.published_date || paper.published_date) && (
                    <div className="flex items-center gap-2 text-gray-500 mb-6">
                      <Calendar size={16} />
                      <span className="text-sm">{contentPreview?.published_date || paper.published_date}</span>
                    </div>
                  )}

                  {(contentPreview?.doi || paper.doi) && (
                    <p className="text-sm text-gray-400 mb-6">
                      DOI:{' '}
                      <a
                        href={(() => { const d = contentPreview?.doi || paper.doi; return d.startsWith('http') ? d : `https://doi.org/${d}`; })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {contentPreview?.doi || paper.doi}
                      </a>
                    </p>
                  )}

                  {/* Abstract section */}
                  {(contentPreview?.abstract || paper.abstract) ? (
                    <div className="mb-6">
                      <h4 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-3">
                        <FileText size={18} />
                        Abstract
                      </h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                        {contentPreview?.abstract || paper.abstract}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 text-sm">
                      <AlertCircle size={16} />
                      Abstract is not available for this paper.
                    </div>
                  )}

                  {/* Content preview from extracted PDF text / vector store */}
                  {contentPreview?.content_preview && (
                    <div>
                      <h4 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-3">
                        <FileText size={18} />
                        Document Content
                      </h4>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">
                          {contentPreview.content_preview}
                        </p>
                        {contentPreview.has_full_content && (
                          <p className="text-xs text-gray-400 mt-3 italic">
                            Showing first portion of the document content.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Nothing at all */}
                  {!contentPreview?.abstract && !paper.abstract && !contentPreview?.content_preview && (
                    <p className="text-gray-400 text-center mt-4">
                      No content could be extracted from this paper.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* PDF iframe */
              <iframe
                src={previewUrl}
                className="flex-1 w-full"
                title="PDF Preview"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
