import React from 'react';
import { X, Quote } from 'lucide-react';
import { DocumentChunk } from '../types';

interface SourceViewerProps {
  chunk: DocumentChunk | null;
  onClose: () => void;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({ chunk, onClose }) => {
  if (!chunk) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-80 md:w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl transform transition-transform duration-300 z-30">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/95">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Quote className="w-4 h-4 text-blue-400"/>
            Source Context
        </h3>
        <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>
      
      <div className="p-6 overflow-y-auto h-[calc(100%-60px)]">
        <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
            <div className="text-xs text-zinc-500 font-mono mb-2 uppercase tracking-widest">
                Source ID: {chunk.id}
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-serif">
                {chunk.text}
            </p>
        </div>
        
        <div className="mt-6">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800 p-3 rounded-md">
                    <span className="block text-xs text-zinc-500">Start Index</span>
                    <span className="block text-sm font-mono text-zinc-300">{chunk.startIndex}</span>
                </div>
                <div className="bg-zinc-800 p-3 rounded-md">
                    <span className="block text-xs text-zinc-500">Length</span>
                    <span className="block text-sm font-mono text-zinc-300">{chunk.text.length} chars</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};