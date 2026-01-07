
import React, { useState, useEffect } from 'react';
import { AudioFile, FileType } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { localBlobService } from '../services/localBlobService';

interface Props {
  item: AudioFile;
}

const TranscriptionItem: React.FC<Props> = ({ item }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const { t } = useAppContext();

  // HYDRATE FILE FROM INDEXEDDB (BLOB STORE) IF MISSING IN MEMORY
  useEffect(() => {
    let activeUrl: string | null = null;

    const loadLocalFile = async () => {
        // If we already have the file in memory (just uploaded), use it
        if (item.file) {
            const url = URL.createObjectURL(item.file);
            setPreviewUrl(url);
            activeUrl = url;
            return;
        }

        // Otherwise, try to fetch from IndexedDB
        if (item.status === 'completed' || item.fileType === 'image' || item.fileType === 'audio') {
            try {
                const blob = await localBlobService.getFile(item.id);
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(url);
                    activeUrl = url;
                }
            } catch (e) {
                console.warn("Could not load local file blob for preview", e);
            }
        }
    };

    loadLocalFile();

    return () => {
        if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [item.id, item.file, item.status, item.fileType]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'processing': return 'bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse';
      case 'error': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-slate-600/20 text-slate-400 border-slate-600/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return t.completed;
      case 'processing': return t.processing;
      case 'error': return t.error;
      default: return t.pending;
    }
  };

  const renderIcon = (type: FileType) => {
      switch(type) {
          case 'image':
              return (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              );
          case 'document':
              return (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-orange-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              );
          case 'text':
              return (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              );
          default: // Audio
              return (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-300">
                    <path fillRule="evenodd" d="M19.902 4.098a3.75 3.75 0 00-5.304 0l-4.5 4.5a3.75 3.75 0 001.035 6.037.75.75 0 01-.646 1.353 5.25 5.25 0 01-1.449-8.45l4.5-4.5a5.25 5.25 0 117.424 7.424l-1.757 1.757a.75.75 0 11-1.06-1.06l1.757-1.757a3.75 3.75 0 000-5.304zm-7.389 4.267a.75.75 0 011-.353 5.25 5.25 0 011.449 8.45l-4.5 4.5a5.25 5.25 0 11-7.424-7.424l1.757-1.757a.75.75 0 111.06 1.06l-1.757-1.757a3.75 3.75 0 105.304 5.304l4.5-4.5a3.75 3.75 0 00-1.035-6.037.75.75 0 01-.354-1z" clipRule="evenodd" />
                </svg>
              );
      }
  };

  const handleCopy = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (item.transcript) {
          navigator.clipboard.writeText(item.transcript);
          setHasCopied(true);
          setTimeout(() => setHasCopied(false), 2000);
      }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-3 hover:border-slate-600 transition-all">
      <div className="flex items-start gap-4">
        
        {/* Icon / Thumbnail */}
        <div className="shrink-0 mt-1 bg-slate-700 p-2 rounded-lg relative group overflow-hidden">
             {item.fileType === 'image' && previewUrl ? (
                 <img src={previewUrl} alt="preview" className="w-10 h-10 object-cover rounded" />
             ) : renderIcon(item.fileType)}
        </div>
        
        {/* Content Wrapper */}
        <div className="flex-1 min-w-0 pr-16">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
               <h4 className="text-sm font-semibold text-white break-words">{item.name}</h4>
               <span className="text-[10px] text-slate-500 uppercase font-mono px-1 rounded bg-slate-800">{item.fileType}</span>
               <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${getStatusColor(item.status)}`}>
                 {getStatusLabel(item.status)}
               </span>
             </div>
             
             {item.summary && (
               <p className="text-sm text-slate-300 italic mb-2 break-words">"{item.summary}"</p>
             )}

             {item.errorMsg && (
               <p className="text-sm text-red-400 break-words">{item.errorMsg}</p>
             )}
             
             {/* AUDIO PLAYER (Local Hydration) */}
             {item.fileType === 'audio' && previewUrl && (
                 <div className="mt-2 mb-2">
                     <audio controls src={previewUrl} className="w-full h-8" />
                 </div>
             )}
             
             {/* Action Link */}
             {item.transcript && (
               <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 mt-1"
               >
                {isExpanded ? t.hide : t.readFull}
               </button>
             )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && item.transcript && (
        <div 
            className="mt-4 pt-4 border-t border-slate-700 animate-in fade-in slide-in-from-top-2 cursor-text select-text"
            onMouseDown={(e) => e.stopPropagation()} // CRITICAL: Stop drag from parent
        >
          <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {item.fileType === 'image' ? 'OCR & Description' : t.fullTranscript}
              </h5>
              <button 
                  onClick={handleCopy}
                  className={`text-xs px-2 py-1 rounded transition-colors ${hasCopied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                  {hasCopied ? "¡Copiado!" : "Copiar Texto"}
              </button>
          </div>
          
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words font-mono bg-slate-900/50 p-3 rounded">
            {item.transcript}
          </p>
          
          {/* Full Image Preview on Expansion */}
          {item.fileType === 'image' && previewUrl && (
              <div className="mt-4">
                  <img src={previewUrl} alt="Full analysis" className="rounded-lg max-h-96 object-contain bg-slate-900" />
              </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptionItem;
