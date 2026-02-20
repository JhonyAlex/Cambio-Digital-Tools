
import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { polishTextContent } from '../../services/geminiService';
import { polisherService } from '../../services/polisherService';
import { useAuth } from '../../contexts/AuthContext';
import { PolisherRecord } from '../../types';

// --- Markdown Renderer ---
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  // Robust Formatter: Handles **Bold** and *WhatsApp Bold/Italic*
  const parseFormatting = (text: string) => {
    // 1. Split by double asterisks (Standard Markdown Bold)
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      // Handle **Bold**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      
      // Handle *Bold/Italic* (inside the remaining parts)
      // We check if the part contains single asterisks
      const subParts = part.split(/(\*.*?\*)/g);
      return subParts.map((subPart, subIndex) => {
          if (subPart.startsWith('*') && subPart.endsWith('*') && subPart.length >= 2) {
              return <span key={`${index}-${subIndex}`} className="font-semibold text-fuchsia-200">{subPart.slice(1, -1)}</span>;
          }
          return subPart;
      });
    });
  };

  const lines = content.split('\n');
  const renderedNodes: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];

  const renderCodeBlock = (buffer: string[], keyIndex: string | number) => {
      const textContent = buffer.join('\n');
      return (
          <div key={`code-${keyIndex}`} className="relative group/code my-4 bg-slate-950 border border-slate-700 rounded-lg overflow-hidden">
            {/* Label / Button - Isolated from selection with select-none and absolute positioning */}
            <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10 select-none">
                <button
                    onClick={() => navigator.clipboard.writeText(textContent)}
                    className="text-[10px] text-slate-500 hover:text-emerald-400 hover:border-emerald-500/50 uppercase font-bold bg-slate-900 px-2 py-1 rounded border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Clic para copiar al portapapeles"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5" />
                    </svg>
                    Copiar WhatsApp
                </button>
            </div>
            {/* Content Container - select-all applies ONLY to this div */}
            <div className="p-4 font-mono text-sm text-emerald-400 whitespace-pre-wrap overflow-x-auto shadow-inner select-all">
                {textContent}
            </div>
          </div>
      );
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // --- HANDLE CODE BLOCKS (WhatsApp Copy Box) ---
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of block
        renderedNodes.push(renderCodeBlock(codeBlockBuffer, i));
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        // Start of block
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line); 
      return;
    }

    // --- HANDLE STANDARD MARKDOWN ---
    
    // Empty lines (Spacing)
    if (!trimmed) {
      renderedNodes.push(<div key={i} className="h-3"></div>);
      return;
    }
    
    // Headers
    if (trimmed.startsWith('### ')) {
        renderedNodes.push(
            <h3 key={i} className="text-lg font-bold text-fuchsia-400 mt-8 mb-3 uppercase tracking-wide border-b border-fuchsia-500/30 pb-2 flex items-center gap-2">
                {parseFormatting(trimmed.slice(4))}
            </h3>
        );
        return;
    }
    if (trimmed.startsWith('## ')) {
        renderedNodes.push(<h4 key={i} className="text-base font-bold text-white mt-6 mb-2">{parseFormatting(trimmed.slice(3))}</h4>);
        return;
    }
    
    // Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        renderedNodes.push(
            <div key={i} className="flex gap-3 ml-2 mb-1">
                <span className="text-fuchsia-500 mt-1.5 text-xs">●</span>
                <div className="flex-1 text-slate-300 leading-relaxed">{parseFormatting(trimmed.slice(2))}</div>
            </div>
        );
        return;
    }
    
    // Standard Paragraphs
    renderedNodes.push(<p key={i} className="text-slate-300 leading-relaxed mb-1">{parseFormatting(trimmed)}</p>);
  });

  // Flush remaining code block if not closed (edge case)
  if (inCodeBlock && codeBlockBuffer.length > 0) {
      renderedNodes.push(renderCodeBlock(codeBlockBuffer, 'end'));
  }

  return (
    <div className="space-y-1 text-slate-300 font-sans text-sm md:text-base pb-10">
      {renderedNodes}
    </div>
  );
};

const TextPolisherTool: React.FC = () => {
  const { apiConfig, t } = useAppContext();
  const { user } = useAuth();
  
  // State
  const [inputText, setInputText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<PolisherRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // Mobile sidebar toggle
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // LOAD HISTORY ON MOUNT
  useEffect(() => {
      if (user?.uid) {
          loadHistory();
      }
  }, [user?.uid]);

  const loadHistory = async () => {
      if (!user?.uid) return;
      try {
          const records = await polisherService.getHistory(user.uid);
          setHistory(records);
      } catch (e) {
          console.error("Failed to load polisher history", e);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      }
  };

  const removeFile = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
      if ((!inputText.trim() && files.length === 0) || !user) return;
      
      setIsProcessing(true);
      setResult(null); 
      
      try {
          const polished = await polishTextContent(inputText, files, apiConfig);
          setResult(polished);

          // SAVE TO HISTORY AUTOMATICALLY
          const newRecord: PolisherRecord = {
              id: crypto.randomUUID(),
              userId: user.uid,
              originalText: inputText || '(Adjunto archivos)',
              polishedContent: polished,
              createdAt: Date.now(),
              hasAttachments: files.length > 0
          };
          
          await polisherService.saveRecord(newRecord);
          await loadHistory();

      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleLoadRecord = (record: PolisherRecord) => {
      setInputText(record.originalText);
      setResult(record.polishedContent);
      setFiles([]); // We don't restore files from history (blobs) for now, just text context
      if (window.innerWidth < 768) setIsHistoryOpen(false); // Close drawer on mobile
  };

  const handleDeleteRecord = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm("¿Eliminar del historial?")) {
          await polisherService.deleteRecord(id);
          await loadHistory();
          // If we deleted the currently viewed item, maybe clear screen? Optional.
      }
  };

  const handleCopy = () => {
      if (result) {
          navigator.clipboard.writeText(result);
      }
  };

  const handleClear = () => {
      setInputText('');
      setFiles([]);
      setResult(null);
  };

  return (
    <div className="flex h-full bg-[#0f172a] overflow-hidden">
        
        {/* --- MAIN CONTENT AREA (FLEX-1) --- */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="bg-fuchsia-600 p-1.5 rounded-lg">✨</span>
                        Redactor Pro
                    </h1>
                    <p className="text-slate-400 text-sm hidden md:block">{t.polisherDesc}</p>
                </div>
                <div className="flex items-center gap-2">
                    {result && (
                        <button onClick={handleClear} className="text-slate-400 hover:text-white text-sm px-3 py-1 border border-slate-700 rounded hover:bg-slate-800 transition-colors">
                            Limpiar
                        </button>
                    )}
                    <button 
                        onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                        className={`md:hidden p-2 rounded-lg ${isHistoryOpen ? 'bg-fuchsia-900/50 text-fuchsia-400' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                        📜
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                
                {/* Input Section */}
                <div className={`flex flex-col border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/50 transition-all duration-300 ${result ? 'md:w-1/3 h-1/3 md:h-full' : 'w-full h-full justify-center items-center'}`}>
                    <div className={`flex flex-col gap-4 p-6 w-full ${result ? '' : 'max-w-3xl'}`}>
                        
                        {/* File Drop Area / List */}
                        <div className="space-y-2">
                            {files.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 text-xs text-white">
                                            <span className="truncate max-w-[100px]">{f.name}</span>
                                            <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-300">✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <input 
                                type="file" 
                                multiple 
                                accept="image/*,application/pdf" 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={handleFileChange}
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs flex items-center gap-2 text-fuchsia-400 hover:text-fuchsia-300 transition-colors font-medium"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                                </svg>
                                Adjuntar Imágenes o PDF
                            </button>
                        </div>

                        <div className="relative w-full">
                            <textarea 
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={t.polisherInputPlaceholder}
                                className={`w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 outline-none focus:border-fuchsia-500 transition-all resize-none shadow-inner ${result ? 'h-32' : 'h-64 text-lg'}`}
                            />
                            <button 
                                onClick={handleProcess}
                                disabled={isProcessing || (!inputText && files.length === 0)}
                                className="absolute bottom-4 right-4 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl shadow-lg transition-all hover:scale-105"
                            >
                                {isProcessing ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        
                        {!result && (
                            <p className="text-center text-xs text-slate-500 mt-4 max-w-md mx-auto">
                                La IA generará automáticamente versiones para WhatsApp, Email, Chat y Documento respetando los hechos. Tu historial se guarda automáticamente.
                            </p>
                        )}
                    </div>
                </div>

                {/* Output Section */}
                {result && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0b1120] p-6 md:p-10 animate-in fade-in slide-in-from-right-4">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                                <h2 className="text-xl font-bold text-white">Resultados Generados</h2>
                                <button 
                                    onClick={handleCopy}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2 rounded-lg transition-all border border-slate-700 flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5" />
                                    </svg>
                                    Copiar Todo
                                </button>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
                                <MarkdownRenderer content={result} />
                            </div>
                            <div className="h-20"></div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* --- HISTORY SIDEBAR (RIGHT) --- */}
        <div className={`fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 transform transition-transform duration-300 z-50 flex flex-col ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'} md:relative md:translate-x-0`}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide">Historial</h3>
                <div className="flex gap-2">
                    <button onClick={() => setIsHistoryOpen(false)} className="md:hidden text-slate-400">✕</button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                {history.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs italic">
                        No hay historial reciente.
                    </div>
                ) : (
                    history.map(item => (
                        <div 
                            key={item.id} 
                            onClick={() => handleLoadRecord(item)}
                            className="bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-fuchsia-500/30 rounded-lg p-3 cursor-pointer group transition-all"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] text-slate-500 font-mono">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </span>
                                <button 
                                    onClick={(e) => handleDeleteRecord(item.id, e)}
                                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    ✕
                                </button>
                            </div>
                            <p className="text-sm text-slate-200 line-clamp-2 leading-snug">
                                {item.originalText.substring(0, 80) || '(Sin texto original)'}
                            </p>
                            {item.hasAttachments && (
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-fuchsia-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                                    </svg>
                                    Adjuntos
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>

    </div>
  );
};

export default TextPolisherTool;
