import { useState, useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';

export default function FileUpload({ onFileSelect, accept = '.pdf' }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (f) {
      setFile(f);
      onFileSelect(f);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  };

  const handleRemove = () => {
    setFile(null);
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <Upload size={36} className="mx-auto mb-3 text-gray-400" />
        <p className="text-sm text-gray-600 font-medium">
          Click or drag a file to upload
        </p>
        <p className="text-xs text-gray-400 mt-1">PDF files only</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {file && (
        <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <FileText size={18} className="text-gray-500" />
          <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
          <span className="text-xs text-gray-400">
            {(file.size / 1024).toFixed(1)} KB
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="text-gray-400 hover:text-red-500"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
