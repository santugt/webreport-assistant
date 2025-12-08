import React, { useRef, useState } from 'react';
import { CheckCircle, Loader2, AlertCircle, Server, HardDrive, FileText, PieChart, UploadCloud } from 'lucide-react';
import { UploadedDocument } from '../types';

// Define the shape of a file found in the "DataToTrain" folder
export interface ScannedFile {
    id: string;
    name: string;
    content: string;
    status: 'idle' | 'indexing' | 'success' | 'error';
}

interface DocumentProcessorProps {
  documents: UploadedDocument[];
  appMode: 'server' | 'admin';
  scannedFiles: ScannedFile[];
  onScanFolder: () => void;
  onIndexSingleFile: (file: ScannedFile) => void;
  onIndexAllFiles: () => void;
  onFileUpload: (file: File) => void;
}

export const DocumentProcessor: React.FC<DocumentProcessorProps> = ({ 
    documents, 
    appMode,
    onFileUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          onFileUpload(file);
      }
      // Reset the input so the same file can be selected again if needed
      e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
          onFileUpload(file);
      }
  };

  const triggerFileUpload = (e: React.MouseEvent) => {
      e.stopPropagation();
      fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-6 p-4 border-b border-zinc-800 bg-zinc-900/50 h-full">
      
      {/* 1. Manual Upload Section (PRIORITY) */}
      <div className="flex flex-col gap-3 pb-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <UploadCloud className="w-3 h-3" /> Upload Sources
          </h2>
          <div 
            onClick={triggerFileUpload}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group relative ${
                isDragging 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-800/30'
            }`}
          >
              <div className={`p-2 rounded-full transition-colors ${
                  isDragging ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 group-hover:bg-blue-500/20 group-hover:text-blue-400'
              }`}>
                <UploadCloud className={`w-5 h-5 ${isDragging ? 'text-blue-400' : 'text-zinc-400 group-hover:text-blue-400'}`} />
              </div>
              <span className={`text-xs font-medium transition-colors ${isDragging ? 'text-blue-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                  {isDragging ? 'Drop file to upload' : 'Click or Drag to Upload File'}
              </span>
              <span className="text-[10px] text-zinc-600">.txt, .md, .json, .pdf (text)</span>
          </div>
          
          {/* Hidden Input but accessible via Ref */}
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
      </div>

      {/* 2. Knowledge Base Status Section */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-[150px] min-h-0">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2 sticky top-0 bg-zinc-900/95 py-2 z-10">
            <Server className="w-3 h-3" />
            Knowledge Base
        </h2>
        
        {documents.length === 0 && (
            <div className="text-xs text-zinc-500 italic p-4 text-center border border-dashed border-zinc-800 rounded mt-2">
                No sources loaded. <br/>
                Drag & Drop or Click to upload.
            </div>
        )}

        {documents.map((doc) => (
          <div key={doc.id} className="flex flex-col bg-zinc-800/80 p-3 rounded-md border border-zinc-700/50 shadow-sm group hover:border-zinc-600/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-emerald-500/10 rounded-md">
                    {appMode === 'server' ? <Server className="w-4 h-4 text-emerald-400" /> : <HardDrive className="w-4 h-4 text-blue-400" />}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-zinc-200 truncate" title={doc.name}>{doc.name}</span>
                    <span className="text-xs text-zinc-500 truncate flex items-center gap-1">
                    {appMode === 'server' ? 'Supabase Cloud' : 'Local Index'}
                    </span>
                </div>
                </div>

                <div className="ml-2 flex-shrink-0">
                {doc.status === 'chunking' || doc.status === 'embedding' ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400 font-mono">{Math.round(doc.progress)}%</span>
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    </div>
                ) : doc.status === 'ready' ? (
                    <div className="flex items-center gap-1 bg-emerald-500/20 px-2 py-1 rounded text-emerald-400 text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        <span>Ready</span>
                    </div>
                ) : doc.status === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-zinc-600" />
                )}
                </div>
            </div>

            {/* Statistics Section */}
            {doc.status === 'ready' && doc.content !== 'Remote Content' && (
                <div className="mt-3 pt-3 border-t border-zinc-700/30 grid grid-cols-2 gap-y-2 gap-x-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Source Size
                        </span>
                        <span className="text-xs font-mono text-zinc-300">
                            {(doc.content.length / 1024).toFixed(1)} KB
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <PieChart className="w-3 h-3" /> Chunk Count
                        </span>
                        <span className="text-xs font-mono text-zinc-300">
                            {doc.chunks.length} segments
                        </span>
                    </div>
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};