import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AudioFile, TimelineGroup, ApiConfig, Project, ChatMessage, Session, SummaryOptions } from '../types';
import { groupFilesByDate, extractDateFromFilename, extractSequenceFromFilename } from '../utils';
import { generateGlobalSummary, processMultimodalContent, chatWithProjectContext } from '../services/geminiService';
import { saveProject } from '../services/storageService';
import TranscriptionItem from './TranscriptionItem';
import Dropzone from './Dropzone';
import SummaryGeneratorModal from './SummaryGeneratorModal';
import { useAppContext } from '../App';

interface Props {
  initialProject: Project;
  apiConfig: ApiConfig;
  onBack: () => void;
}

// --- HELPER COMPONENT: Simple Markdown Renderer ---
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  const parseBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="text-indigo-200 font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-3 text-slate-300 leading-relaxed">
      {content.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        if (trimmed.startsWith('# ')) {
          return <h3 key={i} className="text-2xl font-bold text-white mt-6 mb-3 pb-2 border-b border-indigo-500/30">{trimmed.slice(2)}</h3>;
        }
        if (trimmed.startsWith('## ')) {
          return <h4 key={i} className="text-xl font-semibold text-indigo-300 mt-5 mb-2">{trimmed.slice(3)}</h4>;
        }
        if (trimmed.startsWith('### ')) {
          return <h5 key={i} className="text-lg font-semibold text-indigo-200 mt-4 mb-1">{trimmed.slice(4)}</h5>;
        }
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 ml-2 mb-1">
              <span className="text-indigo-400 mt-1.5">•</span>
              <span className="flex-1">{parseBold(trimmed.slice(2))}</span>
            </div>
          );
        }
        return <p key={i}>{parseBold(trimmed)}</p>;
      })}
    </div>
  );
};

const KnowledgeBase: React.FC<Props> = ({ initialProject, apiConfig, onBack }) => {
  const { t } = useAppContext();
  const [project, setProject] = useState<Project>(initialProject);
  
  // SESSION STATES
  const [activeSessionId, setActiveSessionId] = useState<string>('all');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  // PROCESSING STATES
  const [isProcessing, setIsProcessing] = useState(false);
  const processingQueueRef = useRef<string[]>([]);
  // Increased limit slightly for bulk operations, but kept safe for browser
  const CONCURRENT_LIMIT = 2; 

  // UI STATES
  const [searchTerm, setSearchTerm] = useState('');
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>('desc');
  const [seqOrder, setSeqOrder] = useState<'asc' | 'desc'>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false); 
  const [showChat, setShowChat] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  
  // GLOBAL SUMMARY STATES
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // CHAT STATES
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-save logic
  useEffect(() => {
    const save = async () => {
      try {
        await saveProject(project);
      } catch (e) {
        console.error("Error auto-saving project:", e);
      }
    };
    save();
  }, [project]);

  // Chat scrolling
  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [project.chatHistory, showChat]);

  // --- SESSION LOGIC ---
  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;
    
    const newSession: Session = {
        id: crypto.randomUUID(),
        name: newSessionName.trim(),
        createdAt: Date.now()
    };
    
    setProject(prev => ({
        ...prev,
        sessions: [...(prev.sessions || []), newSession]
    }));
    setNewSessionName('');
    setIsCreatingSession(false);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!confirm(t.deleteSessionConfirm)) return;
    
    setProject(prev => ({
        ...prev,
        sessions: (prev.sessions || []).filter(s => s.id !== sessionId),
        files: prev.files.map(f => f.sessionId === sessionId ? { ...f, sessionId: undefined } : f)
    }));
    
    if (activeSessionId === sessionId) setActiveSessionId('all');
  };

  // --- DRAG AND DROP ---
  const handleDragStart = (e: React.DragEvent, audioId: string) => {
    e.dataTransfer.setData('audioId', audioId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnSession = (e: React.DragEvent, targetSessionId: string | undefined) => {
    e.preventDefault();
    const audioId = e.dataTransfer.getData('audioId');
    if (audioId) {
        setProject(prev => ({
            ...prev,
            files: prev.files.map(f => 
                f.id === audioId ? { ...f, sessionId: targetSessionId } : f
            )
        }));
    }
  };

  // --- PROCESSING LOGIC (MULTIMODAL BATCH) ---
  const handleNewFiles = (newFiles: AudioFile[]) => {
    // 1. VERIFICATION: DUPLICATE CHECK
    // Only verify against existing files in this project
    const existingNames = new Set(project.files.map(f => f.name));
    
    const uniqueFiles = newFiles.filter(f => {
        if (existingNames.has(f.name)) {
            console.warn(`Skipping duplicate file: ${f.name}`);
            return false;
        }
        return true;
    });

    if (uniqueFiles.length < newFiles.length) {
        alert(`Se detectaron ${newFiles.length - uniqueFiles.length} duplicados. Solo se añadirán ${uniqueFiles.length} archivos nuevos.`);
    }

    if (uniqueFiles.length === 0) return;

    setProject(prev => ({ ...prev, files: [...prev.files, ...uniqueFiles] }));
    setShowAddModal(false);
  };

  useEffect(() => {
    const processQueue = async () => {
      const pendingFiles = project.files.filter(f => f.status === 'pending');
      
      if (pendingFiles.length === 0 && processingQueueRef.current.length === 0) {
        setIsProcessing(false);
        return;
      }

      setIsProcessing(true);
      const activeCount = processingQueueRef.current.length;
      const slotsAvailable = CONCURRENT_LIMIT - activeCount;

      if (slotsAvailable <= 0) return;

      const nextBatch = pendingFiles.slice(0, slotsAvailable);
      if (nextBatch.length === 0) return;

      const batchIds = nextBatch.map(f => f.id);
      processingQueueRef.current = [...processingQueueRef.current, ...batchIds];
      
      setProject(prev => ({
        ...prev,
        files: prev.files.map(f => batchIds.includes(f.id) ? { ...f, status: 'processing' } : f)
      }));

      nextBatch.forEach(async (fileObj) => {
        if (!fileObj.file) {
           processingQueueRef.current = processingQueueRef.current.filter(id => id !== fileObj.id);
           return;
        }

        try {
          // CALL NEW MULTIMODAL SERVICE
          const result = await processMultimodalContent(fileObj.file, apiConfig);
          
          setProject(prev => ({
            ...prev,
            files: prev.files.map(f => 
              f.id === fileObj.id 
                ? { ...f, status: 'completed', transcript: result.text, summary: result.summary, file: undefined } 
                : f
            )
          }));
        } catch (error) {
           setProject(prev => ({
            ...prev,
            files: prev.files.map(f => 
              f.id === fileObj.id 
                ? { ...f, status: 'error', errorMsg: (error as Error).message, file: undefined } 
                : f
            )
          }));
        } finally {
          processingQueueRef.current = processingQueueRef.current.filter(id => id !== fileObj.id);
        }
      });
    };

    const interval = setInterval(processQueue, 1000);
    return () => clearInterval(interval);
  }, [project.files, apiConfig]);

  // --- FILTERING ---
  const filteredFiles = useMemo(() => {
    let files = project.files;
    if (activeSessionId === 'unassigned') {
        files = files.filter(f => !f.sessionId);
    } else if (activeSessionId !== 'all') {
        files = files.filter(f => f.sessionId === activeSessionId);
    }
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        files = files.filter(f => 
            f.name.toLowerCase().includes(lower) || 
            f.transcript?.toLowerCase().includes(lower) ||
            f.summary?.toLowerCase().includes(lower)
        );
    }
    return files;
  }, [project.files, searchTerm, activeSessionId]);

  const groups: TimelineGroup[] = useMemo(() => 
    groupFilesByDate(filteredFiles, dateOrder, seqOrder), 
    [filteredFiles, dateOrder, seqOrder]
  );

  const completedCount = useMemo(() => project.files.filter(f => f.status === 'completed').length, [project.files]);
  const pendingCount = useMemo(() => project.files.filter(f => f.status === 'pending' || f.status === 'processing').length, [project.files]);
  
  const activeSessionName = activeSessionId === 'all' 
    ? t.all
    : activeSessionId === 'unassigned' 
        ? t.inbox
        : project.sessions?.find(s => s.id === activeSessionId)?.name || 'Session';

  // --- ACTIONS ---
  
  const handleOpenSummaryGenerator = () => {
      if (completedCount === 0) return;
      setShowSummaryModal(true);
  };

  const handleGenerateSummary = async (selectedFiles: AudioFile[], options: SummaryOptions) => {
    setIsGeneratingSummary(true);
    try {
      const chronologicallySorted = [...selectedFiles] 
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.sequence - b.sequence);
      
      // Batch limit text to avoid token overflow in massive summaries
      // Taking first 500 chars of each if selected count > 50
      const texts = chronologicallySorted.map(f => {
          let txt = f.transcript || "";
          if (selectedFiles.length > 50 && txt.length > 1000) {
              txt = txt.substring(0, 1000) + "... [truncated]";
          }
          return `[${f.date.toLocaleDateString()} - ${f.name}]: ${txt}`;
      });
      
      const summary = await generateGlobalSummary(texts, apiConfig, options);
      
      setProject(prev => ({ ...prev, globalSummary: summary }));
      setShowSummaryModal(false); 
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleCopySummary = () => {
    if (!project.globalSummary) return;
    navigator.clipboard.writeText(project.globalSummary).then(() => {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    });
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: chatInput,
      timestamp: Date.now()
    };

    setProject(prev => ({ ...prev, chatHistory: [...prev.chatHistory, userMsg] }));
    setChatInput('');
    setIsChatting(true);

    try {
      const contextFiles = filteredFiles.length > 0 ? filteredFiles : project.files;
      const responseText = await chatWithProjectContext(userMsg.text, project.chatHistory, contextFiles, apiConfig);
      
      const modelMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setProject(prev => ({ ...prev, chatHistory: [...prev.chatHistory, modelMsg] }));
    } catch (e: any) {
       setProject(prev => ({ 
           ...prev, 
           chatHistory: [...prev.chatHistory, {
               id: crypto.randomUUID(),
               role: 'model',
               text: "Error: " + e.message,
               timestamp: Date.now()
           }] 
        }));
    } finally {
      setIsChatting(false);
    }
  };

  const handleDeleteFile = (id: string) => {
    if(confirm(t.deleteAudioConfirm)) {
        setProject(prev => ({ ...prev, files: prev.files.filter(f => f.id !== id) }));
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]">
      
      {/* --- SESSION SIDEBAR --- */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
         <div className="p-4 border-b border-slate-800 flex items-center justify-between">
             <div className="flex items-center gap-2 overflow-hidden">
                 <button onClick={onBack} className="text-slate-400 hover:text-white shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5" />
                    </svg>
                 </button>
                 <h2 className="font-bold text-white truncate text-sm" title={project.name}>{project.name}</h2>
             </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
             <p className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-2">{t.navigation}</p>
             
             <button
                onClick={() => setActiveSessionId('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    activeSessionId === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
             >
                 <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                    {t.all}
                 </span>
                 <span className="bg-slate-700/50 px-1.5 rounded text-[10px]">{project.files.length}</span>
             </button>

             <button
                onClick={() => setActiveSessionId('unassigned')}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnSession(e, undefined)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    activeSessionId === 'unassigned' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
             >
                 <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    {t.inbox}
                 </span>
                 <span className="bg-slate-700/50 px-1.5 rounded text-[10px]">{project.files.filter(f => !f.sessionId).length}</span>
             </button>
             
             <div className="border-t border-slate-800 my-2 pt-2">
                 <div className="flex items-center justify-between px-3 mb-2">
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.sessions}</p>
                     <button onClick={() => setIsCreatingSession(true)} className="text-blue-400 hover:text-blue-300">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                     </button>
                 </div>
                 
                 {isCreatingSession && (
                     <div className="px-3 mb-2">
                         <input 
                            autoFocus
                            type="text" 
                            className="w-full bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white outline-none"
                            placeholder={t.sessionNamePlaceholder}
                            value={newSessionName}
                            onChange={e => setNewSessionName(e.target.value)}
                            onKeyDown={e => {
                                if(e.key === 'Enter') handleCreateSession();
                                if(e.key === 'Escape') setIsCreatingSession(false);
                            }}
                            onBlur={() => { if(!newSessionName) setIsCreatingSession(false); }}
                         />
                     </div>
                 )}

                 {project.sessions?.map(session => (
                     <div 
                        key={session.id}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnSession(e, session.id)}
                        className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                            activeSessionId === session.id ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
                        }`}
                        onClick={() => setActiveSessionId(session.id)}
                     >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                            <span className="truncate">{session.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] opacity-50">{project.files.filter(f => f.sessionId === session.id).length}</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                     </div>
                 ))}
                 
                 {(!project.sessions || project.sessions.length === 0) && (
                     <div className="px-3 py-4 text-center text-xs text-slate-600 italic border-2 border-dashed border-slate-800 rounded mx-3">
                         {t.noSessions}
                     </div>
                 )}
             </div>
         </div>
      </div>

      {/* --- MAIN CONTENT (TIMELINE) --- */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 relative bg-[#0f172a] ${showChat ? 'md:mr-96' : ''}`}>
        
        {/* Top Navbar */}
        <div className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 py-4 flex justify-between items-center shrink-0 z-20">
            <div>
                 <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                     <span className="truncate max-w-[100px]">{project.name}</span>
                     <span>/</span>
                     <span className="text-blue-400">{activeSessionName}</span>
                 </div>
                 <h2 className="text-xl font-bold text-white truncate max-w-xs">{activeSessionName}</h2>
            </div>
            
            <div className="flex items-center gap-3">
                {/* BATCH PROGRESS BAR */}
                {pendingCount > 0 && (
                    <div className="hidden md:flex flex-col w-40 mr-4">
                        <div className="flex justify-between text-[10px] text-blue-300 mb-1 font-bold uppercase">
                            <span>Procesando...</span>
                            <span>{pendingCount} pendientes</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 animate-pulse rounded-full w-full opacity-50"></div>
                        </div>
                    </div>
                )}

                <button 
                    onClick={() => setShowChat(!showChat)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        showChat 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                    {t.chat}
                </button>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg"
                    title={t.addAudios}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                </button>
            </div>
        </div>

        {/* Scrollable Timeline Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
            
            {/* Toolbar */}
            <div className="flex flex-wrap gap-4 mb-6">
                <input
                    type="text"
                    placeholder={t.filterPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                <button 
                    onClick={handleOpenSummaryGenerator}
                    disabled={isGeneratingSummary || completedCount === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium border border-slate-700 disabled:opacity-50"
                >
                    {t.updateSummary}
                </button>
            </div>

            {/* GLOBAL SUMMARY CARD */}
            {project.globalSummary && activeSessionId === 'all' && (
                <div className="mb-10 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-2xl overflow-hidden shadow-xl shadow-indigo-900/10">
                    <div className="bg-indigo-950/40 px-6 py-4 flex items-center justify-between border-b border-indigo-500/20 backdrop-blur-sm">
                        <h3 className="text-indigo-200 font-bold flex items-center gap-2 text-lg">
                           {t.execSummary}
                        </h3>
                        <button onClick={handleCopySummary} className="text-indigo-300 hover:text-white text-xs">
                            {hasCopied ? t.copied : t.copyMd}
                        </button>
                    </div>
                    <div className="p-8">
                        <SimpleMarkdownRenderer content={project.globalSummary} />
                    </div>
                </div>
            )}

            {/* TIMELINE */}
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-800 z-0">
                {groups.map((group) => (
                    <div key={group.dateStr} className="relative z-10">
                        <div className="flex items-center justify-center mb-6">
                            <span className="bg-slate-900 border border-slate-700 text-blue-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                {group.dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>
                        <div className="space-y-4 max-w-3xl mx-auto">
                            {group.items.map(item => (
                                <div 
                                    key={item.id} 
                                    className="relative group/item cursor-grab active:cursor-grabbing"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, item.id)}
                                >
                                    <TranscriptionItem item={item} />
                                    {/* Updated Absolute positioning with higher z-index and translation to avoid overlap */}
                                    <div className="absolute right-2 top-2 z-10 opacity-0 group-hover/item:opacity-100 flex gap-2">
                                        <button 
                                            onClick={() => handleDeleteFile(item.id)}
                                            className="bg-slate-900/80 text-slate-400 hover:text-red-400 transition-all p-1.5 rounded shadow-sm hover:shadow-md"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                        <div title="Move" className="bg-slate-900/80 text-slate-400 p-1.5 rounded cursor-grab shadow-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                
                {groups.length === 0 && (
                     <div className="text-center py-20 opacity-50">
                        <p>No audios found.</p>
                     </div>
                )}
            </div>
            
            <div className="h-20"></div> {/* Spacing */}
        </div>
      </div>

      {/* RIGHT: CHAT PANEL */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl transform transition-transform duration-300 z-50 flex flex-col ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
            <h3 className="font-bold text-white flex items-center gap-2">{t.chatContext}</h3>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0b1120]">
            {project.chatHistory.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            {isChatting && (
                <div className="flex justify-start">
                    <div className="bg-slate-800 px-4 py-3 border border-slate-700 rounded-2xl rounded-bl-none">
                        <span className="animate-pulse">...</span>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800">
            <div className="relative">
                <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    placeholder={`${t.chatPlaceholder} ${activeSessionName}...`}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-12 max-h-32"
                />
                <button 
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isChatting}
                    className="absolute right-2 top-2 p-1.5 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                    ➔
                </button>
            </div>
        </div>
      </div>

      {/* MODAL: ADD FILES */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-white">{t.addAudios}: {activeSessionName}</h3>
                    <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <div className="p-8">
                    <Dropzone 
                        onFilesAdded={(files) => {
                            const targetSession = (activeSessionId !== 'all' && activeSessionId !== 'unassigned') ? activeSessionId : undefined;
                            
                            const processed = files.map(f => ({
                                ...f,
                                id: crypto.randomUUID(),
                                sequence: extractSequenceFromFilename(f.name),
                                date: extractDateFromFilename(f.name),
                                sessionId: targetSession // Auto-assign
                            }));
                            handleNewFiles(processed);
                        }} 
                        t={t}
                    />
                    <p className="text-xs text-slate-500 mt-4 text-center">
                        Sistema inteligente de detección de duplicados activo.
                    </p>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: GENERATE SUMMARY (NEW) */}
      <SummaryGeneratorModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        files={project.files}
        sessions={project.sessions}
        activeSessionId={activeSessionId}
        onGenerate={handleGenerateSummary}
        isGenerating={isGeneratingSummary}
        t={t}
      />

    </div>
  );
};

export default KnowledgeBase;
