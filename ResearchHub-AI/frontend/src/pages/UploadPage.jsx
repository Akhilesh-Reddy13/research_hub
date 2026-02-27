import { useState, useEffect } from 'react';
import { Upload as UploadIcon, Loader2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';

export default function UploadPage() {
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadWs = async () => {
      try {
        const res = await api.get('/workspaces');
        setWorkspaces(res.data.workspaces || []);
      } catch {
        toast.error('Failed to load workspaces');
      }
    };
    loadWs();
  }, []);

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a PDF file');
      return;
    }
    if (!selectedWs) {
      toast.error('Please select a workspace');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspace_id', selectedWs);

    setUploading(true);
    try {
      await api.post('/papers/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('PDF uploaded successfully!');
      setFile(null);
      setSelectedWs('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <UploadIcon size={28} className="text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">Upload PDF</h1>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 space-y-5">
        {/* Workspace selector */}
        <div>
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

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload File
          </label>
          <FileUpload onFileSelect={setFile} />
        </div>

        {/* Submit */}
        <button
          onClick={handleUpload}
          disabled={uploading || !file || !selectedWs}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <UploadIcon size={18} />
              Upload PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}
