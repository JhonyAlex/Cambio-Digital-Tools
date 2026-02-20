
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { meetingService } from '../../services/meetingService';
import { analyzeMeetingTranscript } from '../../services/geminiService';
import { MeetingAnalysis, MeetingTask } from '../../types';

const MeetingAnalystTool: React.FC = () => {
  const { apiConfig, t } = useAppContext();
  const { user } = useAuth();

  const [inputTranscript, setInputTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<MeetingAnalysis | null>(null);
  const [history, setHistory] = useState<MeetingAnalysis[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'transcript' | 'notes'>('overview');
  
  // Mobile history drawer
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Grouping State
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [editingClientForId, setEditingClientForId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');

  useEffect(() => {
      if (user?.uid) loadHistory();
  }, [user?.uid]);

  const loadHistory = async () => {
      if (!user?.uid) return;
      const records = await meetingService.getHistory(user.uid);
      setHistory(records);
  };

  const handleAnalyze = async () => {
      if (!inputTranscript.trim() || !user) return;
      
      setIsProcessing(true);
      setActiveAnalysis(null);

      try {
          const result = await analyzeMeetingTranscript(inputTranscript, apiConfig);
          
          const newAnalysis: MeetingAnalysis = {
              id: crypto.randomUUID(),
              userId: user.uid,
              createdAt: Date.now(),
              ...result
          };

          // Sanitize client name if missing
          if (!newAnalysis.meta.client) {
              newAnalysis.meta.client = "Sin Cliente / Interno";
          }

          await meetingService.saveAnalysis(newAnalysis);
          await loadHistory();
          setActiveAnalysis(newAnalysis);
          setInputTranscript(''); // Clear input
          setExpandedClient(newAnalysis.meta.client || "Sin Cliente / Interno");
      } catch (e: any) {
          alert("Error analizando reunión: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleTaskToggle = async (taskId: string) => {
      if (!activeAnalysis) return;
      
      const task = activeAnalysis.tasks.find(t => t.id === taskId);
      if (!task) return;

      const newStatus: MeetingTask['status'] = task.status === 'done' ? 'pending' : 'done';
      
      // Optimistic update
      const updatedTasks = activeAnalysis.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      setActiveAnalysis({ ...activeAnalysis, tasks: updatedTasks });

      await meetingService.updateTaskStatus(activeAnalysis.id, taskId, newStatus);
  };

  const handleNotesChange = async (notes: string) => {
      if (!activeAnalysis) return;
      setActiveAnalysis({ ...activeAnalysis, userNotes: notes });
  };

  const handleNotesBlur = async () => {
      if (activeAnalysis) {
          await meetingService.updateUserNotes(activeAnalysis.id, activeAnalysis.userNotes || '');
      }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm("¿Eliminar este análisis?")) {
          await meetingService.deleteAnalysis(id);
          await loadHistory();
          if (activeAnalysis?.id === id) setActiveAnalysis(null);
      }
  };

  const startEditingClient = (item: MeetingAnalysis, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingClientForId(item.id);
      setNewClientName(item.meta.client || "Sin Cliente");
  };

  const saveClientEdit = async (id: string) => {
      if (!newClientName.trim()) return;
      
      // Optimistic update local
      const updatedHistory = history.map(h => h.id === id ? { ...h, meta: { ...h.meta, client: newClientName.trim() } } : h);
      setHistory(updatedHistory);
      
      if (activeAnalysis?.id === id) {
          setActiveAnalysis({ ...activeAnalysis, meta: { ...activeAnalysis.meta, client: newClientName.trim() } });
      }

      await meetingService.updateAnalysisMeta(id, { client: newClientName.trim() });
      setEditingClientForId(null);
  };

  // --- Grouping Logic ---
  const groupedHistory = useMemo(() => {
      const groups: Record<string, MeetingAnalysis[]> = {};
      history.forEach(item => {
          const client = item.meta.client || "Sin Cliente / Interno";
          if (!groups[client]) groups[client] = [];
          groups[client].push(item);
      });
      return groups;
  }, [history]);

  const sortedClients = useMemo(() => {
      return Object.keys(groupedHistory).sort();
  }, [groupedHistory]);

  const getSentimentColor = (s: string) => {
      if (s === 'positive') return 'text-emerald-400 bg-emerald-900/30 border-emerald-500/30';
      if (s === 'negative') return 'text-red-400 bg-red-900/30 border-red-500/30';
      return 'text-blue-400 bg-blue-900/30 border-blue-500/30';
  };

  const getTaskIcon = (type: string) => {
      switch(type) {
          case 'operational': return '⚙️';
          case 'technical': return '💻';
          case 'administrative': return '📁';
          case 'follow_up': return '👀';
          default: return '📌';
      }
  };

  return (
    <div className="flex h-full bg-[#0f172a] overflow-hidden">
        
        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="bg-indigo-600 p-1.5 rounded-lg">📊</span>
                        Analista de Reuniones
                    </h1>
                    <p className="text-slate-400 text-sm hidden md:block">{t.meetingDesc}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => { setActiveAnalysis(null); setInputTranscript(''); }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-indigo-900/20"
                    >
                        + Nuevo Análisis
                    </button>
                    <button 
                        onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                        className="md:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-800"
                    >
                        📜
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden bg-[#0b1120] relative">
                
                {/* STATE 1: INPUT FORM */}
                {!activeAnalysis && (
                    <div className="absolute inset-0 p-6 md:p-10 overflow-y-auto flex flex-col items-center custom-scrollbar">
                        <div className="w-full max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl">
                                <label className="block text-sm font-bold text-slate-300 uppercase mb-4">
                                    Pega aquí la transcripción de tu reunión
                                </label>
                                <textarea 
                                    className="w-full h-64 bg-slate-950 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all font-mono text-sm resize-none"
                                    placeholder="[00:00] Juan: Hola a todos, gracias por venir..."
                                    value={inputTranscript}
                                    onChange={e => setInputTranscript(e.target.value)}
                                />
                                <div className="mt-4 flex justify-end">
                                    <button 
                                        onClick={handleAnalyze}
                                        disabled={isProcessing || !inputTranscript.trim()}
                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/20 flex items-center gap-2 transition-all"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Analizando...
                                            </>
                                        ) : (
                                            <>
                                                ⚡ Analizar Reunión
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                                    <div className="text-2xl mb-2">📋</div>
                                    <h4 className="text-white font-bold text-sm">Resumen Ejecutivo</h4>
                                    <p className="text-slate-500 text-xs">Decisiones y problemas clave</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                                    <div className="text-2xl mb-2">✅</div>
                                    <h4 className="text-white font-bold text-sm">Tareas Automáticas</h4>
                                    <p className="text-slate-500 text-xs">Detección de responsables</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                                    <div className="text-2xl mb-2">📈</div>
                                    <h4 className="text-white font-bold text-sm">Organización por Cliente</h4>
                                    <p className="text-slate-500 text-xs">Agrupación automática</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STATE 2: ANALYSIS DASHBOARD */}
                {activeAnalysis && (
                    <div className="absolute inset-0 flex flex-col animate-in fade-in zoom-in-95">
                        
                        {/* Meta Header */}
                        <div className="bg-slate-900/50 border-b border-slate-800 p-6 flex flex-wrap gap-6 items-center shrink-0 backdrop-blur-md">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-2xl font-bold text-white">{activeAnalysis.meta.title || "Reunión sin título"}</h2>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getSentimentColor(activeAnalysis.metrics.sentiment)}`}>
                                        {activeAnalysis.metrics.sentiment}
                                    </span>
                                </div>
                                <div className="flex gap-4 text-xs text-slate-400">
                                    <span className="flex items-center gap-1 font-bold text-indigo-400">🏢 {activeAnalysis.meta.client || "Interno"}</span>
                                    <span className="flex items-center gap-1">📅 {activeAnalysis.meta.date}</span>
                                    <span className="flex items-center gap-1">👥 {activeAnalysis.meta.team || "General"}</span>
                                    <span className="flex items-center gap-1">🏷️ {activeAnalysis.meta.type || "Reunión"}</span>
                                </div>
                            </div>
                            
                            {/* Radial Metrics */}
                            <div className="flex gap-6">
                                <div className="text-center">
                                    <div className="text-xs text-slate-500 mb-1 font-bold">CALIDAD</div>
                                    <div className="text-xl font-bold text-emerald-400">{activeAnalysis.metrics.qualityScore}%</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-slate-500 mb-1 font-bold">PARTICIPACIÓN</div>
                                    <div className="text-xl font-bold text-blue-400">{activeAnalysis.metrics.participationScore}%</div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-800 bg-slate-900/30 px-6 shrink-0">
                            {[
                                { id: 'overview', label: 'Resumen & Detalles' },
                                { id: 'tasks', label: `Tareas (${activeAnalysis.tasks.length})` },
                                { id: 'transcript', label: 'Transcripción' },
                                { id: 'notes', label: 'Notas Privadas' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === tab.id 
                                        ? 'border-indigo-500 text-white' 
                                        : 'border-transparent text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            
                            {/* TAB: OVERVIEW */}
                            {activeTab === 'overview' && (
                                <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-2">
                                    {/* Executive Summary */}
                                    <section>
                                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">📄 Resumen Ejecutivo</h3>
                                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-300 leading-relaxed text-sm shadow-sm">
                                            {activeAnalysis.summary.executive}
                                        </div>
                                    </section>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <section>
                                            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">Decisiones Tomadas</h3>
                                            <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-4">
                                                <ul className="space-y-2">
                                                    {activeAnalysis.summary.decisions.length > 0 ? activeAnalysis.summary.decisions.map((d, i) => (
                                                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                                                            <span className="text-emerald-500">✓</span> {d}
                                                        </li>
                                                    )) : <li className="text-slate-500 italic text-sm">No se detectaron decisiones explícitas.</li>}
                                                </ul>
                                            </div>
                                        </section>

                                        <section>
                                            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">Problemas / Bloqueos</h3>
                                            <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4">
                                                <ul className="space-y-2">
                                                    {activeAnalysis.summary.problems.length > 0 ? activeAnalysis.summary.problems.map((p, i) => (
                                                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                                                            <span className="text-red-500">⚠</span> {p}
                                                        </li>
                                                    )) : <li className="text-slate-500 italic text-sm">No se detectaron problemas críticos.</li>}
                                                </ul>
                                            </div>
                                        </section>
                                    </div>

                                    {/* Chapters */}
                                    <section>
                                        <h3 className="text-lg font-bold text-white mb-3">📑 Capítulos y Temas</h3>
                                        <div className="space-y-3">
                                            {activeAnalysis.chapters.map((chap, i) => (
                                                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/30 transition-colors">
                                                    <div className="flex justify-between mb-1">
                                                        <h4 className="font-bold text-white text-sm">{chap.title}</h4>
                                                        {chap.startTime && <span className="text-xs font-mono text-indigo-400 bg-indigo-900/20 px-2 rounded">{chap.startTime}</span>}
                                                    </div>
                                                    <p className="text-sm text-slate-400">{chap.summary}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Q&A */}
                                    {activeAnalysis.questions.length > 0 && (
                                        <section>
                                            <h3 className="text-lg font-bold text-white mb-3">❓ Preguntas Clave</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {activeAnalysis.questions.map((q, i) => (
                                                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                                        <p className="font-bold text-slate-200 text-sm mb-2">P: {q.question}</p>
                                                        <p className="text-slate-400 text-sm italic">R: {q.answer}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}

                            {/* TAB: TASKS */}
                            {activeTab === 'tasks' && (
                                <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-2">
                                    <div className="mb-6 flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-white">Plan de Acción</h3>
                                        <span className="text-xs bg-indigo-600 px-2 py-1 rounded text-white font-bold">{activeAnalysis.tasks.filter(t => t.status === 'pending').length} Pendientes</span>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {activeAnalysis.tasks.length === 0 ? (
                                            <div className="text-center py-10 text-slate-500">No se detectaron tareas accionables.</div>
                                        ) : (
                                            activeAnalysis.tasks.map(task => (
                                                <div 
                                                    key={task.id} 
                                                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                                                        task.status === 'done' 
                                                        ? 'bg-slate-900/30 border-slate-800 opacity-60' 
                                                        : 'bg-slate-900 border-slate-700 hover:border-indigo-500/50'
                                                    }`}
                                                >
                                                    <button 
                                                        onClick={() => handleTaskToggle(task.id)}
                                                        className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                                            task.status === 'done' 
                                                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                                                            : 'border-slate-500 hover:border-emerald-400'
                                                        }`}
                                                    >
                                                        {task.status === 'done' && '✓'}
                                                    </button>
                                                    
                                                    <div className="flex-1">
                                                        <div className={`text-sm font-medium mb-1 ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>
                                                            {task.description}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 text-xs">
                                                            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">
                                                                {getTaskIcon(task.type)} {task.type}
                                                            </span>
                                                            {task.assignee && (
                                                                <span className="bg-indigo-900/30 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">
                                                                    👤 {task.assignee}
                                                                </span>
                                                            )}
                                                            {task.dueDate && (
                                                                <span className="bg-red-900/20 text-red-300 px-2 py-0.5 rounded border border-red-500/20">
                                                                    📅 {task.dueDate}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: TRANSCRIPT */}
                            {activeTab === 'transcript' && (
                                <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-2">
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                        {activeAnalysis.originalTranscript}
                                    </div>
                                </div>
                            )}

                            {/* TAB: NOTES */}
                            {activeTab === 'notes' && (
                                <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-2 h-full flex flex-col">
                                    <label className="block text-sm font-bold text-slate-400 mb-2">Notas Privadas</label>
                                    <textarea 
                                        className="flex-1 w-full bg-slate-900 border border-slate-700 rounded-xl p-6 text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all resize-none leading-relaxed"
                                        placeholder="Escribe tus notas personales aquí... (No se comparten)"
                                        value={activeAnalysis.userNotes || ''}
                                        onChange={e => handleNotesChange(e.target.value)}
                                        onBlur={handleNotesBlur}
                                    />
                                    <p className="text-xs text-slate-500 mt-2 text-right">Se guarda automáticamente al salir.</p>
                                </div>
                            )}

                        </div>
                    </div>
                )}

            </div>
        </div>

        {/* --- RIGHT SIDEBAR: HISTORY (GROUPED BY CLIENT) --- */}
        <div className={`fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 transform transition-transform duration-300 z-50 flex flex-col ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'} md:relative md:translate-x-0`}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide">Historial Clientes</h3>
                <div className="flex gap-2">
                    <button onClick={() => setIsHistoryOpen(false)} className="md:hidden text-slate-400">✕</button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {history.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs italic">
                        No hay reuniones analizadas.
                    </div>
                ) : (
                    sortedClients.map(clientName => {
                        const items = groupedHistory[clientName];
                        const isExpanded = expandedClient === clientName;
                        
                        return (
                            <div key={clientName} className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800/30">
                                <button 
                                    onClick={() => setExpandedClient(isExpanded ? null : clientName)}
                                    className={`w-full flex justify-between items-center p-3 text-left transition-colors ${isExpanded ? 'bg-indigo-900/20 text-indigo-300' : 'hover:bg-slate-800 text-slate-300'}`}
                                >
                                    <span className="font-bold text-sm truncate max-w-[180px]">{clientName}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full border border-slate-700">{items.length}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                        </svg>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="bg-slate-900/50 p-2 space-y-2 border-t border-slate-700">
                                        {items.map(item => (
                                            <div 
                                                key={item.id} 
                                                className={`rounded-lg p-2.5 cursor-pointer group transition-all relative ${
                                                    activeAnalysis?.id === item.id 
                                                    ? 'bg-indigo-600/10 border border-indigo-500/50' 
                                                    : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                                                }`}
                                                onClick={() => { setActiveAnalysis(item); if(window.innerWidth < 768) setIsHistoryOpen(false); }}
                                            >
                                                {/* Editing Client Mode */}
                                                {editingClientForId === item.id ? (
                                                    <div className="flex flex-col gap-2 p-1" onClick={e => e.stopPropagation()}>
                                                        <input 
                                                            autoFocus
                                                            type="text" 
                                                            className="bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white outline-none w-full"
                                                            value={newClientName}
                                                            onChange={e => setNewClientName(e.target.value)}
                                                            onKeyDown={e => {
                                                                if(e.key === 'Enter') saveClientEdit(item.id);
                                                                if(e.key === 'Escape') setEditingClientForId(null);
                                                            }}
                                                        />
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => setEditingClientForId(null)} className="text-[10px] text-slate-400 hover:text-white">Cancel</button>
                                                            <button onClick={() => saveClientEdit(item.id)} className="text-[10px] bg-indigo-600 px-2 py-0.5 rounded text-white hover:bg-indigo-500">Guardar</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[10px] text-slate-500 font-mono">
                                                                {new Date(item.createdAt).toLocaleDateString()}
                                                            </span>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={(e) => startEditingClient(item, e)}
                                                                    className="text-slate-500 hover:text-indigo-400 p-1"
                                                                    title="Mover a otro cliente"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => handleDelete(item.id, e)}
                                                                    className="text-slate-500 hover:text-red-400 p-1"
                                                                    title="Eliminar"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <h4 className="text-xs font-bold text-slate-200 mb-1 truncate leading-tight">{item.meta.title}</h4>
                                                        <div className="flex gap-2 mt-1.5">
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getSentimentColor(item.metrics.sentiment)}`}>
                                                                {item.metrics.sentiment}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>

    </div>
  );
};

export default MeetingAnalystTool;
