
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AudioFile, TimelineGroup, ApiConfig, Project, ChatMessage, Session, SummaryOptions } from '../types';
import { groupFilesByDate, extractDateFromFilename, extractSequenceFromFilename, convertAudioToWav, readFileAsText } from '../utils';
import { generateGlobalSummary, processMultimodalContent, chatWithProjectContext, generateMaintenanceReport } from '../services/geminiService';
import { saveProject } from '../services/storageService';
import { localBlobService } from '../services/localBlobService';
import { processMaintenanceCSV } from '../services/maintenanceReportService';
import TranscriptionItem from './TranscriptionItem';
import Dropzone from './Dropzone';
import SummaryGeneratorModal from './SummaryGeneratorModal';
import { useAppContext } from '../hooks/useAppContext';

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
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');

  // PROCESSING STATES
  const [isProcessing, setIsProcessing] = useState(false);
  const processingQueueRef = useRef<string[]>([]);
  const CONCURRENT_LIMIT = 2; 

  // UI STATES
  const [searchTerm, setSearchTerm] = useState('');
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>('desc');
  const [seqOrder, setSeqOrder] = useState<'asc' | 'desc'>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'file' | 'text'>('file'); 
  const [textInput, setTextInput] = useState('');
  const [textTitle, setTextTitle] = useState('');

  const [showSummaryModal, setShowSummaryModal] = useState(false); 
  const [showChat, setShowChat] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [project.chatHistory, showChat]);

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;
    const newSession: Session = { id: crypto.randomUUID(), name: newSessionName.trim(), createdAt: Date.now() };
    setProject(prev => ({ ...prev, sessions: [...(prev.sessions || []), newSession] }));
    setNewSessionName('');
    setIsCreatingSession(false);
    setActiveSessionId(newSession.id);
  };

  const handleRenameSession = (id: string) => {
      if(!editSessionName.trim()) { setEditingSessionId(null); return; }
      setProject(prev => ({ ...prev, sessions: prev.sessions?.map(s => s.id === id ? { ...s, name: editSessionName.trim() } : s) }));
      setEditingSessionId(null);
  };

  const startRenameSession = (s: Session) => { setEditSessionName(s.name); setEditingSessionId(s.id); };

  const handleDeleteSession = (sessionId: string) => {
    if (!confirm(t.deleteSessionConfirm)) return;
    setProject(prev => ({ ...prev, sessions: (prev.sessions || []).filter(s => s.id !== sessionId), files: prev.files.map(f => f.sessionId === sessionId ? { ...f, sessionId: undefined } : f) }));
    if (activeSessionId === sessionId) setActiveSessionId('all');
  };

  const handleDragStart = (e: React.DragEvent, audioId: string) => { e.dataTransfer.setData('audioId', audioId); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDropOnSession = (e: React.DragEvent, targetSessionId: string | undefined) => { e.preventDefault(); const audioId = e.dataTransfer.getData('audioId'); if (audioId) { setProject(prev => ({ ...prev, files: prev.files.map(f => f.id === audioId ? { ...f, sessionId: targetSessionId } : f) })); } };

  const handleNewFiles = (newFiles: AudioFile[]) => {
    const existingNames = new Set(project.files.map(f => f.name));
    const uniqueFiles = newFiles.filter(f => { if (existingNames.has(f.name)) { console.warn(`Skipping duplicate file: ${f.name}`); return false; } return true; });
    if (uniqueFiles.length < newFiles.length) { alert(`Se detectaron ${newFiles.length - uniqueFiles.length} duplicados. Solo se añadirán ${uniqueFiles.length} archivos nuevos.`); }
    if (uniqueFiles.length === 0) return;
    setProject(prev => ({ ...prev, files: [...prev.files, ...uniqueFiles] }));
    setShowAddModal(false); setTextInput(''); setTextTitle('');
  };

  const handleTextSubmission = () => {
      if(!textInput.trim()) { alert(t.textEmpty); return; }
      const title = textTitle.trim() || `Texto - ${new Date().toLocaleTimeString()}`;
      const blob = new Blob([textInput], { type: 'text/plain' });
      const file = new File([blob], `${title}.txt`, { type: 'text/plain' });
      const targetSession = (activeSessionId !== 'all' && activeSessionId !== 'unassigned') ? activeSessionId : undefined;
      const audioFile: AudioFile = { id: crypto.randomUUID(), file: file, name: file.name, date: new Date(), sequence: 0, status: 'pending', fileType: 'text', sessionId: targetSession };
      handleNewFiles([audioFile]);
  };

  const handleRetryFailed = () => {
      setProject(prev => ({
          ...prev,
          files: prev.files.map(f => f.status === 'error' ? { ...f, status: 'pending', errorMsg: undefined } : f)
      }));
  };

  useEffect(() => {
    const processQueue = async () => {
      const pendingFiles = project.files.filter(f => f.status === 'pending');
      
      // If nothing pending, stop processing flag
      if (pendingFiles.length === 0) { 
          // If queue is empty but active count > 0, we are finishing up.
          if (processingQueueRef.current.length === 0) {
              setIsProcessing(false); 
          }
          return; 
      }
      
      setIsProcessing(true);
      const activeCount = processingQueueRef.current.length;
      const slotsAvailable = CONCURRENT_LIMIT - activeCount;
      
      if (slotsAvailable <= 0) return;
      
      const nextBatch = pendingFiles.slice(0, slotsAvailable);
      if (nextBatch.length === 0) return;
      
      const batchIds = nextBatch.map(f => f.id);
      
      // Mark as processing visually
      setProject(prev => ({ ...prev, files: prev.files.map(f => batchIds.includes(f.id) ? { ...f, status: 'processing' } : f) }));
      
      // Add to Ref Queue immediately
      processingQueueRef.current = [...processingQueueRef.current, ...batchIds];
      
      nextBatch.forEach(async (fileObj) => {
        try {
          // ── CSV DETECTION: skip Gemini, store raw content ──
          const isCSV = fileObj.file?.name.toLowerCase().endsWith('.csv');
          if (isCSV && fileObj.file) {
            const rawText = await readFileAsText(fileObj.file);
            setProject(prev => ({
              ...prev,
              files: prev.files.map(f => 
                f.id === fileObj.id 
                  ? { ...f, status: 'completed', transcript: rawText, summary: 'CSV Primavera — Mano de Obra', file: undefined }
                  : f
              )
            }));
            processingQueueRef.current = processingQueueRef.current.filter(id => id !== fileObj.id);
            return;
          }

          // Hydrate file if it's missing (rare, usually happens on reload)
          let fileToProcess = fileObj.file;
          
          if (!fileToProcess) {
              // Try to load from blob store if not in memory
              try {
                  const blob = await localBlobService.getFile(fileObj.id);
                  if (blob) {
                      fileToProcess = new File([blob], fileObj.name, { type: blob.type });
                  } else {
                      throw new Error("File content not found (Blob missing)");
                  }
              } catch (e) {
                  throw new Error("Could not restore file for processing");
              }
          }

          const ext = fileObj.name.split('.').pop()?.toLowerCase();
          
          // --- AUTO-CONVERSION FOR WHATSAPP/OGG ---
          if (fileToProcess && (ext === 'ogg' || ext === 'opus' || fileToProcess.type.includes('ogg') || fileToProcess.type.includes('opus'))) {
              try {
                  fileToProcess = await convertAudioToWav(fileToProcess);
              } catch (conversionError) {
                  console.warn("Audio conversion failed, trying raw upload...", conversionError);
              }
          }

          // Save cleaned file to local storage
          await localBlobService.saveFile(fileObj.id, fileToProcess);
          
          // API CALL (Retry logic is now in geminiService)
          const result = await processMultimodalContent(fileToProcess, apiConfig);
          
          setProject(prev => ({ ...prev, files: prev.files.map(f => f.id === fileObj.id ? { ...f, status: 'completed', transcript: result.text, summary: result.summary, file: undefined } : f) }));
        } catch (error: any) {
           console.error("Processing error for file " + fileObj.id, error);
           setProject(prev => ({ ...prev, files: prev.files.map(f => f.id === fileObj.id ? { ...f, status: 'error', errorMsg: error.message, file: undefined } : f) }));
        } finally { 
            // Release slot
            processingQueueRef.current = processingQueueRef.current.filter(id => id !== fileObj.id); 
        }
      });
    };
    
    const interval = setInterval(processQueue, 2000); // Check queue every 2s
    return () => clearInterval(interval);
  }, [project.files, apiConfig]);

  const filteredFiles = useMemo(() => {
    let files = project.files;
    if (activeSessionId === 'unassigned') { files = files.filter(f => !f.sessionId); } else if (activeSessionId !== 'all') { files = files.filter(f => f.sessionId === activeSessionId); }
    if (searchTerm) { const lower = searchTerm.toLowerCase(); files = files.filter(f => f.name.toLowerCase().includes(lower) || f.transcript?.toLowerCase().includes(lower) || f.summary?.toLowerCase().includes(lower) ); }
    return files;
  }, [project.files, searchTerm, activeSessionId]);

  const groups: TimelineGroup[] = useMemo(() => groupFilesByDate(filteredFiles, dateOrder, seqOrder), [filteredFiles, dateOrder, seqOrder]);
  const completedCount = useMemo(() => project.files.filter(f => f.status === 'completed').length, [project.files]);
  const pendingCount = useMemo(() => project.files.filter(f => f.status === 'pending' || f.status === 'processing').length, [project.files]);
  const errorCount = useMemo(() => project.files.filter(f => f.status === 'error').length, [project.files]);
  
  const activeSessionName = activeSessionId === 'all' ? t.all : activeSessionId === 'unassigned' ? t.inbox : project.sessions?.find(s => s.id === activeSessionId)?.name || 'Session';

  const handleOpenSummaryGenerator = () => { if (completedCount === 0) return; setShowSummaryModal(true); };
  const handleGenerateSummary = async (selectedFiles: AudioFile[], options: SummaryOptions) => {
    setIsGeneratingSummary(true);
    try {
      // ── MODO REPORTE DE MANTENIMIENTO ──
      if (options.focus === 'maintenance_report') {
        const csvFiles = selectedFiles.filter(f => 
          f.fileType === 'text' && (f.name.toLowerCase().endsWith('.csv') || f.transcript)
        );
        
        if (csvFiles.length === 0) {
          alert(t.maintenanceNoCSV);
          setIsGeneratingSummary(false);
          return;
        }

        const csvContent = csvFiles[0].transcript || '';
        if (!csvContent.trim()) {
          alert(t.maintenanceNoCSV);
          setIsGeneratingSummary(false);
          return;
        }

        const periodType = options.periodType || 'semanal';
        const reportData = processMaintenanceCSV(csvContent, periodType);
        
        if (!reportData) {
          alert(t.maintenanceError);
          setIsGeneratingSummary(false);
          return;
        }

        const narrativeReport = await generateMaintenanceReport(
          reportData.statsSummary,
          periodType,
          apiConfig
        );

        const verifiedHeader = `## 📊 Datos Verificados del Período\n\n` +
          `Período ${reportData.stats.periodType === 'semanal' ? 'Semanal' : 'Mensual'}: ${reportData.stats.periodLabel}\n\n` +
          `| Métrica | Valor |\n| :--- | ---: |\n` +
          `| OTs únicas | **${reportData.stats.uniqueOTs}** |\n` +
          `| Registros de M.O. | **${reportData.stats.totalRecords}** |\n` +
          `| Horas totales | **${reportData.stats.totalHoursFormatted}** |\n` +
          `| Trabajadores | **${reportData.stats.workers.map(w => w.name).join(', ')}** |\n\n` +
          `---\n\n`;
        
        setProject(prev => ({ ...prev, globalSummary: verifiedHeader + narrativeReport }));
        setShowSummaryModal(false);
        setIsGeneratingSummary(false);
        return;
      }

      // ── MODO NORMAL ──
      const chronologicallySorted = [...selectedFiles].sort((a, b) => a.date.getTime() - b.date.getTime() || a.sequence - b.sequence);
      const texts = chronologicallySorted.map(f => { let txt = f.transcript || ""; if (selectedFiles.length > 50 && txt.length > 1000) { txt = txt.substring(0, 1000) + "... [truncated]"; } return `[${f.date.toLocaleDateString()} - ${f.name}]: ${txt}`; });
      const summary = await generateGlobalSummary(texts, apiConfig, options);
      setProject(prev => ({ ...prev, globalSummary: summary }));
      setShowSummaryModal(false); 
    } catch (e: any) { alert("Error: " + e.message); } finally { setIsGeneratingSummary(false); }
  };

  const handleCopySummary = () => { if (!project.globalSummary) return; navigator.clipboard.writeText(project.globalSummary).then(() => { setHasCopied(true); setTimeout(() => setHasCopied(false), 2000); }); };
  const handleClearSummary = () => { if(confirm("¿Ocultar este reporte?")) { setProject(prev => ({ ...prev, globalSummary: undefined })); } };
  const handleSendMessage = async () => { if (!chatInput.trim() || isChatting) return; const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: chatInput, timestamp: Date.now() }; setProject(prev => ({ ...prev, chatHistory: [...prev.chatHistory, userMsg] })); setChatInput(''); setIsChatting(true); try { const contextFiles = filteredFiles.length > 0 ? filteredFiles : project.files; const responseText = await chatWithProjectContext(userMsg.text, project.chatHistory, contextFiles, apiConfig); const modelMsg: ChatMessage = { id: crypto.randomUUID(), role: 'model', text: responseText, timestamp: Date.now() }; setProject(prev => ({ ...prev, chatHistory: [...prev.chatHistory, modelMsg] })); } catch (e: any) { setProject(prev => ({ ...prev, chatHistory: [...prev.chatHistory, { id: crypto.randomUUID(), role: 'model', text: "Error: " + e.message, timestamp: Date.now() }] })); } finally { setIsChatting(false); } };
  const handleDeleteFile = async (id: string) => { if(confirm(t.deleteAudioConfirm)) { setProject(prev => ({ ...prev, files: prev.files.filter(f => f.id !== id) })); try { await localBlobService.deleteFile(id); } catch (e) { console.warn("Could not delete local blob", e); } } };

  return (
    <div className="flex h-full overflow-hidden bg-[#0f172a]">
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
         <div className="p-4 border-b border-slate-800 flex items-center justify-between">
             <div className="flex items-center gap-2 overflow-hidden">
                 <button onClick={onBack} className="text-slate-400 hover:text-white shrink-0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5" /></svg></button>
                 <h2 className="font-bold text-white truncate text-sm" title={project.name}>{project.name}</h2>
             </div>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
             <p className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-2">{t.navigation}</p>
             <button onClick={() => setActiveSessionId('all')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${activeSessionId === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>{t.all}</span><span className="bg-slate-700/50 px-1.5 rounded text-[10px]">{project.files.length}</span></button>
             <button onClick={() => setActiveSessionId('unassigned')} onDragOver={handleDragOver} onDrop={(e) => handleDropOnSession(e, undefined)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${activeSessionId === 'unassigned' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>{t.inbox}</span><span className="bg-slate-700/50 px-1.5 rounded text-[10px]">{project.files.filter(f => !f.sessionId).length}</span></button>
             <div className="border-t border-slate-800 my-2 pt-2">
                 <div className="flex items-center justify-between px-3 mb-2"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.sessions}</p><button onClick={() => setIsCreatingSession(true)} className="text-blue-400 hover:text-blue-300"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button></div>
                 {isCreatingSession && (<div className="px-3 mb-2"><input autoFocus type="text" className="w-full bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white outline-none" placeholder={t.sessionNamePlaceholder} value={newSessionName} onChange={e => setNewSessionName(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleCreateSession(); if(e.key === 'Escape') setIsCreatingSession(false); }} onBlur={() => { if(!newSessionName) setIsCreatingSession(false); }} /></div>)}
                 {project.sessions?.map(session => (
                     <div key={session.id} onDragOver={handleDragOver} onDrop={(e) => handleDropOnSession(e, session.id)} className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${activeSessionId === session.id ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'}`} onClick={() => setActiveSessionId(session.id)}>
                        {editingSessionId === session.id ? (
                            <input autoFocus type="text" className="w-full bg-slate-950 border border-blue-500 rounded px-1 py-0.5 text-xs text-white outline-none" value={editSessionName} onChange={e => setEditSessionName(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleRenameSession(session.id); if(e.key === 'Escape') setEditingSessionId(null); }} onBlur={() => handleRenameSession(session.id)} onClick={e => e.stopPropagation()} />
                        ) : (
                            <div className="flex items-center gap-2 overflow-hidden flex-1" onDoubleClick={() => startRenameSession(session)}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg><span className="truncate">{session.name}</span></div>
                        )}
                        <div className="flex items-center gap-2"><span className="text-[10px] opacity-50">{project.files.filter(f => f.sessionId === session.id).length}</span><div className="hidden group-hover:flex gap-1"><button onClick={(e) => { e.stopPropagation(); startRenameSession(session); }} className="text-slate-500 hover:text-blue-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></button><button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }} className="text-slate-500 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
                     </div>
                 ))}
                 {(!project.sessions || project.sessions.length === 0) && (<div className="px-3 py-4 text-center text-xs text-slate-600 italic border-2 border-dashed border-slate-800 rounded mx-3">{t.noSessions}</div>)}
             </div>
         </div>
      </div>

      {/* TIMELINE */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 relative bg-[#0f172a] ${showChat ? 'md:mr-96' : ''}`}>
        <div className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 py-4 flex justify-between items-center shrink-0 z-20">
            <div><div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><span className="truncate max-w-[100px]">{project.name}</span><span>/</span><span className="text-blue-400">{activeSessionName}</span></div><h2 className="text-xl font-bold text-white truncate max-w-xs">{activeSessionName}</h2></div>
            <div className="flex items-center gap-3">
                {pendingCount > 0 && (<div className="hidden md:flex flex-col w-40 mr-4"><div className="flex justify-between text-[10px] text-blue-300 mb-1 font-bold uppercase"><span>Procesando...</span><span>{pendingCount} pendientes</span></div><div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 animate-pulse rounded-full w-full opacity-50"></div></div></div>)}
                {errorCount > 0 && (
                    <button 
                        onClick={handleRetryFailed} 
                        className="bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 px-3 py-2 rounded-lg text-xs font-bold animate-pulse hover:animate-none flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                        Reintentar ({errorCount})
                    </button>
                )}
                <button onClick={() => setShowChat(!showChat)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${showChat ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{t.chat}</button><button onClick={() => { setShowAddModal(true); setAddMode('file'); }} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg" title={t.addAudios}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
            <div className="flex flex-wrap gap-4 mb-6"><input type="text" placeholder={t.filterPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /><button onClick={handleOpenSummaryGenerator} disabled={isGeneratingSummary || completedCount === 0} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium border border-slate-700 disabled:opacity-50">{t.updateSummary}</button></div>
            {project.globalSummary && (
                <div className="mb-10 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-2xl overflow-hidden shadow-xl shadow-indigo-900/10 relative group animate-in fade-in slide-in-from-top-4">
                    <div className="bg-indigo-950/40 px-6 py-4 flex items-center justify-between border-b border-indigo-500/20 backdrop-blur-sm"><h3 className="text-indigo-200 font-bold flex items-center gap-2 text-lg">{t.execSummary}</h3><div className="flex items-center gap-3"><button onClick={handleCopySummary} className="text-indigo-300 hover:text-white text-xs px-2 py-1 rounded hover:bg-indigo-500/20 transition-colors">{hasCopied ? t.copied : t.copyMd}</button><button onClick={handleClearSummary} className="text-slate-400 hover:text-white hover:bg-red-500/20 p-1.5 rounded transition-colors" title="Ocultar Reporte"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div></div><div className="p-8"><SimpleMarkdownRenderer content={project.globalSummary} /></div>
                </div>
            )}
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-800 z-0">
                {groups.map((group) => (
                    <div key={group.dateStr} className="relative z-10">
                        <div className="flex items-center justify-center mb-6"><span className="bg-slate-900 border border-slate-700 text-blue-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{group.dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
                        <div className="space-y-4 max-w-3xl mx-auto">{group.items.map(item => (<div key={item.id} className="relative group/item cursor-grab active:cursor-grabbing" draggable onDragStart={(e) => handleDragStart(e, item.id)}><TranscriptionItem item={item} /><div className="absolute right-2 top-2 z-10 opacity-0 group-hover/item:opacity-100 flex gap-2"><button onClick={() => handleDeleteFile(item.id)} className="bg-slate-900/80 text-slate-400 hover:text-red-400 transition-all p-1.5 rounded shadow-sm hover:shadow-md"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button><div title="Move" className="bg-slate-900/80 text-slate-400 p-1.5 rounded cursor-grab shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg></div></div></div>))}</div>
                    </div>
                ))}
                {groups.length === 0 && (<div className="text-center py-20 opacity-50"><p>No content found.</p></div>)}
            </div>
            <div className="h-20"></div>
        </div>
      </div>

      {/* CHAT PANEL */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-slate-900 border-l border-slate-800 transform transition-transform duration-300 flex flex-col z-30 ${showChat ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <h3 className="font-bold text-white flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  {t.chatContext}
              </h3>
              <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-[#0b1120]">
              {project.chatHistory.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm">
                      <p>{t.prompt_chat_system}</p>
                      <p className="mt-2 text-xs text-slate-600">Pregunta sobre tus audios...</p>
                  </div>
              ) : (
                  project.chatHistory.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'}`}>
                              <SimpleMarkdownRenderer content={msg.text} />
                          </div>
                      </div>
                  ))
              )}
              {isChatting && (
                  <div className="flex justify-start">
                      <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 text-sm text-slate-400">
                          <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                          </div>
                      </div>
                  </div>
              )}
              <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900">
              <div className="relative">
                  <textarea 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                          }
                      }}
                      placeholder={t.chatPlaceholder}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:border-indigo-500 outline-none resize-none h-12 max-h-32"
                  />
                  <button 
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isChatting}
                      className="absolute right-2 top-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:bg-slate-700 transition-colors"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                      </svg>
                  </button>
              </div>
          </div>
      </div>

      {/* MODALS */}
      {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="flex border-b border-slate-700">
                      <button onClick={() => setAddMode('file')} className={`flex-1 py-3 text-sm font-medium ${addMode === 'file' ? 'bg-slate-800 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-white'}`}>{t.uploadTab}</button>
                      <button onClick={() => setAddMode('text')} className={`flex-1 py-3 text-sm font-medium ${addMode === 'text' ? 'bg-slate-800 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-white'}`}>{t.textTab}</button>
                  </div>
                  <div className="p-6">
                      {addMode === 'file' ? (
                          <Dropzone onFilesAdded={handleNewFiles} t={t} />
                      ) : (
                          <div className="space-y-4">
                              <input type="text" placeholder={t.textTitlePlaceholder} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500" value={textTitle} onChange={e => setTextTitle(e.target.value)} />
                              <textarea placeholder={t.pastePlaceholder} className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 resize-none text-sm" value={textInput} onChange={e => setTextInput(e.target.value)} />
                              <button onClick={handleTextSubmission} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold transition-colors">{t.processText}</button>
                          </div>
                      )}
                  </div>
                  <div className="p-4 bg-slate-800 flex justify-end">
                      <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-sm">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      <SummaryGeneratorModal isOpen={showSummaryModal} onClose={() => setShowSummaryModal(false)} files={project.files} sessions={project.sessions} activeSessionId={activeSessionId} onGenerate={handleGenerateSummary} isGenerating={isGeneratingSummary} t={t} />

    </div>
  );
};

export default KnowledgeBase;
