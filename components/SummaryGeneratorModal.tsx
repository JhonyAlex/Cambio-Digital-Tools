import React, { useState, useEffect } from 'react';
import { AudioFile, SummaryOptions, Session } from '../types';
import { translations } from '../translations';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  files: AudioFile[];
  sessions: Session[] | undefined;
  activeSessionId: string;
  onGenerate: (selectedFiles: AudioFile[], options: SummaryOptions) => void;
  isGenerating: boolean;
  t: typeof translations;
}

const SummaryGeneratorModal: React.FC<Props> = ({ 
  isOpen, onClose, files, sessions, activeSessionId, onGenerate, isGenerating, t 
}) => {
  // State for Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // State for Options
  const [options, setOptions] = useState<SummaryOptions>({
    focus: 'general',
    format: 'markdown',
    length: 'concise',
  });

  // Filter files that are actually completed
  const completedFiles = files.filter(f => f.status === 'completed' && f.transcript);

  // Initialize selection when opening
  useEffect(() => {
    if (isOpen) {
      // By default select all visible files in current session context
      let preSelected = completedFiles;
      if (activeSessionId !== 'all') {
         if (activeSessionId === 'unassigned') {
             preSelected = completedFiles.filter(f => !f.sessionId);
         } else {
             preSelected = completedFiles.filter(f => f.sessionId === activeSessionId);
         }
      }
      setSelectedIds(new Set(preSelected.map(f => f.id)));
    }
  }, [isOpen, activeSessionId]);

  if (!isOpen) return null;

  const handleToggleFile = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => setSelectedIds(new Set(completedFiles.map(f => f.id)));
  const handleDeselectAll = () => setSelectedIds(new Set());

  const handleSubmit = () => {
    const selected = completedFiles.filter(f => selectedIds.has(f.id));
    onGenerate(selected, options);
  };

  const currentSessionName = sessions?.find(s => s.id === activeSessionId)?.name || (activeSessionId === 'all' ? t.all : t.inbox);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col md:flex-row">
        
        {/* LEFT COLUMN: File Selection */}
        <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-700 min-h-[300px]">
           <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">{t.selectFiles}</h3>
                  <p className="text-xs text-slate-400 mt-1">{selectedIds.size} {t.selected}</p>
              </div>
              <div className="flex gap-2 text-xs">
                  <button onClick={handleSelectAll} className="text-blue-400 hover:text-white">{t.selectAll}</button>
                  <span className="text-slate-600">|</span>
                  <button onClick={handleDeselectAll} className="text-slate-400 hover:text-white">{t.deselectAll}</button>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-slate-900/50">
               {completedFiles.length === 0 ? (
                   <div className="p-8 text-center text-slate-500 italic text-sm">
                       No completed transcripts found.
                   </div>
               ) : (
                   completedFiles.map(file => (
                       <div 
                         key={file.id} 
                         onClick={() => handleToggleFile(file.id)}
                         className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                             selectedIds.has(file.id) 
                             ? 'bg-blue-600/10 border-blue-500/50' 
                             : 'bg-slate-800/30 border-transparent hover:bg-slate-800'
                         }`}
                       >
                           <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                               selectedIds.has(file.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-500'
                           }`}>
                               {selectedIds.has(file.id) && (
                                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                   </svg>
                               )}
                           </div>
                           <div className="min-w-0">
                               <p className={`text-sm font-medium truncate ${selectedIds.has(file.id) ? 'text-blue-100' : 'text-slate-300'}`}>
                                   {file.name}
                               </p>
                               <p className="text-xs text-slate-500 flex gap-2">
                                   <span>{file.date.toLocaleDateString()}</span>
                                   <span>•</span>
                                   <span className="truncate max-w-[150px] italic">"{file.summary?.substring(0, 30)}..."</span>
                               </p>
                           </div>
                       </div>
                   ))
               )}
           </div>
        </div>

        {/* RIGHT COLUMN: Options */}
        <div className="w-full md:w-80 bg-slate-800 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-700 bg-slate-800">
                <h3 className="font-bold text-white text-lg">{t.summaryTitle}</h3>
                <p className="text-sm text-slate-400">Context: {currentSessionName}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                
                 {/* FOCUS */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.focus}</label>
                    <div className="space-y-2">
                        {[
                            { id: 'general', label: t.focusGeneral, icon: '📋' },
                            { id: 'action_items', label: t.focusAction, icon: '✅' },
                            { id: 'decisions', label: t.focusDecisions, icon: '⚖️' },
                            { id: 'sentiment', label: t.focusSentiment, icon: '❤️' },
                            { id: 'maintenance_report', label: t.focusMaintenance, icon: '🔧' },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setOptions({...options, focus: opt.id as any, periodType: opt.id === 'maintenance_report' ? (options.periodType || 'semanal') : undefined})}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition-all ${
                                    options.focus === opt.id 
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20' 
                                    : 'bg-slate-700/50 border-slate-700 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                <span className="text-lg">{opt.icon}</span>
                                <span className="font-medium">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* PERIOD TYPE (solo para mantenimiento) */}
                {options.focus === 'maintenance_report' && (
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.maintenanceMode}</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'semanal', label: t.maintenanceWeekly },
                            { id: 'mensual', label: t.maintenanceMonthly },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setOptions({...options, periodType: opt.id as 'semanal' | 'mensual'})}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                    options.periodType === opt.id
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-slate-700/50 border-slate-700 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                )}

                {/* FORMAT & LENGTH */}
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.format}</label>
                        <select 
                            value={options.format}
                            onChange={(e) => setOptions({...options, format: e.target.value as any})}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-blue-500"
                        >
                            <option value="markdown">{t.formatMd}</option>
                            <option value="bullet_points">{t.formatBullets}</option>
                            <option value="email">{t.formatEmail}</option>
                        </select>
                     </div>

                     <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.length}</label>
                        <select 
                            value={options.length}
                            onChange={(e) => setOptions({...options, length: e.target.value as any})}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-blue-500"
                        >
                            <option value="concise">{t.lenConcise}</option>
                            <option value="detailed">{t.lenDetailed}</option>
                        </select>
                     </div>
                </div>

            </div>

            {/* Footer Action */}
            <div className="p-5 border-t border-slate-700 bg-slate-800 flex justify-end gap-3">
                <button 
                    onClick={onClose}
                    disabled={isGenerating}
                    className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                >
                    {t.cancel}
                </button>
                <button 
                    onClick={handleSubmit}
                    disabled={isGenerating || selectedIds.size === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating && (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    )}
                    {t.generateBtn}
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default SummaryGeneratorModal;