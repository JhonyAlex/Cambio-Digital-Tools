import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  MAINTENANCE_FIELDS, 
  parseExcelOrCSVFile, 
  autoDetectColumnMapping, 
  mapAndNormalizeRows, 
  computeMaintenanceStats, 
  buildStatsSummary, 
  getStoredMappingPreference, 
  saveStoredMappingPreference, 
  getAllMappingPresets, 
  saveMappingPreset, 
  deleteMappingPreset, 
  getReportHistory, 
  saveReportToHistory, 
  deleteReportFromHistory, 
  ParsedWorkbookResult 
} from '../../services/maintenanceReportService';
import { generateMaintenanceReport } from '../../services/geminiService';
import { 
  MaintenanceColumnMapping, 
  MaintenanceFieldKey, 
  MaintenanceRow, 
  MaintenanceStats, 
  MaintenanceReportRecord, 
  ColumnMappingPreference 
} from '../../types';

const MaintenanceReportTool: React.FC = () => {
  const { apiConfig, t } = useAppContext();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File & Parsing State
  const [fileName, setFileName] = useState<string>('');
  const [parsedWorkbook, setParsedWorkbook] = useState<ParsedWorkbookResult | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Mapping Modal & Preference State
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [columnMapping, setColumnMapping] = useState<MaintenanceColumnMapping>({});
  const [mappingSources, setMappingSources] = useState<Record<MaintenanceFieldKey, 'saved_preference' | 'auto_detected' | 'unmapped'>>({} as any);
  const [saveAsDefaultPref, setSaveAsDefaultPref] = useState(true);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [presets, setPresets] = useState<ColumnMappingPreference[]>([]);

  // Normalized Data & Stats State
  const [normalizedRows, setNormalizedRows] = useState<MaintenanceRow[]>([]);
  const [periodType, setPeriodType] = useState<'semanal' | 'mensual' | 'custom'>('semanal');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'workers' | 'types' | 'assets' | 'data' | 'report' | 'history'>('overview');

  // AI Narrative State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [narrativeReport, setNarrativeReport] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [reportHistory, setReportHistory] = useState<MaintenanceReportRecord[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Table filtering & pagination
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // Load presets & report history on mount
  useEffect(() => {
    setPresets(getAllMappingPresets());
    setReportHistory(getReportHistory());
  }, []);

  // Compute stats whenever normalizedRows, periodType or custom dates change
  const stats = useMemo<MaintenanceStats | null>(() => {
    if (normalizedRows.length === 0) return null;
    const startDate = customStart ? new Date(customStart) : undefined;
    const endDate = customEnd ? new Date(customEnd) : undefined;
    return computeMaintenanceStats(normalizedRows, periodType, startDate, endDate);
  }, [normalizedRows, periodType, customStart, customEnd]);

  // Handle File Upload
  const handleFileProcess = async (file: File) => {
    setIsReadingFile(true);
    try {
      setFileName(file.name);
      const parsed = await parseExcelOrCSVFile(file);
      setParsedWorkbook(parsed);

      // Auto detect columns using saved preferences and heuristics
      const detection = autoDetectColumnMapping(parsed.headers);
      setColumnMapping(detection.mapping);
      setMappingSources(detection.sources);

      // Open the confirmation and mapping modal so user can confirm / reassign
      setShowMappingModal(true);
    } catch (e: any) {
      alert("Error al leer el archivo: " + (e.message || "Formato no válido."));
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // Confirm mapping and compute normalized rows
  const handleConfirmMapping = () => {
    if (!parsedWorkbook) return;

    // Check required fields
    const missingRequired = MAINTENANCE_FIELDS.filter(f => f.required && !columnMapping[f.key]);
    if (missingRequired.length > 0) {
      alert(`Por favor asigna los campos obligatorios: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    // Save as default preference if checked
    if (saveAsDefaultPref) {
      saveStoredMappingPreference(columnMapping);
    }

    // Map and normalize rows
    const rows = mapAndNormalizeRows(parsedWorkbook.allRawRows, columnMapping);
    setNormalizedRows(rows);
    setShowMappingModal(false);
    setActiveTab('overview');
    setNarrativeReport(''); // Reset narrative for new data
  };

  // Save named preset
  const handleSavePreset = () => {
    if (!presetNameInput.trim()) return;
    const created = saveMappingPreset(presetNameInput, columnMapping);
    setPresets(getAllMappingPresets());
    setPresetNameInput('');
    alert(`Preset "${created.name}" guardado.`);
  };

  // Load a named preset
  const handleApplyPreset = (presetId: string) => {
    const found = presets.find(p => p.id === presetId);
    if (!found || !parsedWorkbook) return;
    const detection = autoDetectColumnMapping(parsedWorkbook.headers, found.mapping);
    setColumnMapping(detection.mapping);
    setMappingSources(detection.sources);
  };

  // Generate Executive AI Report
  const handleGenerateReport = async () => {
    if (!stats) return;
    setIsGeneratingReport(true);
    setActiveTab('report');

    try {
      const statsSummary = buildStatsSummary(stats);
      const reportText = await generateMaintenanceReport(
        statsSummary,
        periodType,
        apiConfig,
        additionalNotes
      );

      setNarrativeReport(reportText);

      // Save to history
      const record: MaintenanceReportRecord = {
        id: crypto.randomUUID(),
        userId: user?.uid,
        fileName,
        periodType,
        periodLabel: stats.periodLabel,
        stats,
        narrativeReport: reportText,
        createdAt: Date.now(),
        customNotes: additionalNotes
      };

      saveReportToHistory(record);
      setReportHistory(getReportHistory());
      setActiveReportId(record.id);
    } catch (e: any) {
      alert("Error al generar el reporte con IA: " + (e.message || "Verifica tu configuración de IA."));
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Copy Markdown to Clipboard
  const handleCopyMarkdown = () => {
    if (!narrativeReport) return;
    navigator.clipboard.writeText(narrativeReport);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Download Markdown file
  const handleDownloadMarkdown = () => {
    if (!narrativeReport) return;
    const blob = new Blob([narrativeReport], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Mantenimiento_${stats?.periodLabel.replace(/\s+/g, '_') || 'General'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print / Export PDF
  const handlePrintPdf = () => {
    window.print();
  };

  // Restore past report from history
  const handleRestoreReport = (record: MaintenanceReportRecord) => {
    setNarrativeReport(record.narrativeReport);
    setFileName(record.fileName);
    setPeriodType(record.periodType);
    setActiveReportId(record.id);
    setActiveTab('report');
  };

  const handleDeleteReport = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Eliminar este reporte del historial?")) {
      deleteReportFromHistory(id);
      setReportHistory(getReportHistory());
      if (activeReportId === id) {
        setActiveReportId(null);
        setNarrativeReport('');
      }
    }
  };

  // Filtered raw data rows for table tab
  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return normalizedRows;
    const q = tableSearch.toLowerCase();
    return normalizedRows.filter(r => 
      r.ot.toLowerCase().includes(q) ||
      r.trabajador.toLowerCase().includes(q) ||
      r.activo.toLowerCase().includes(q) ||
      r.tipoOT.toLowerCase().includes(q) ||
      r.observaciones.toLowerCase().includes(q) ||
      r.descripcionTareas.toLowerCase().includes(q)
    );
  }, [normalizedRows, tableSearch]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  return (
    <div className="h-full flex flex-col bg-[#0f172a] text-slate-100 overflow-hidden">
      
      {/* ── TOP HEADER ── */}
      <header className="px-6 py-4 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600/20 text-teal-400 flex items-center justify-center font-bold text-xl border border-teal-500/30 shadow-lg shadow-teal-950">
            🔧
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {t.maintenanceTitle || 'Reporte de Mantenimiento Sem/Mes'}
              {fileName && (
                <span className="text-xs font-normal bg-teal-500/10 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-500/20 truncate max-w-xs">
                  📄 {fileName}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              {t.maintenanceDesc || 'Análisis de mano de obra, OTs, preventivo vs correctivo e informes ejecutivos.'}
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {parsedWorkbook && (
            <button
              onClick={() => setShowMappingModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 transition-all hover:scale-105"
              title="Ajustar o reasignar columnas del Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
              {t.maintenanceReassignBtn || 'Reasignar Columnas'}
            </button>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileInputChange} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isReadingFile}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition-all hover:scale-105 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            {isReadingFile ? 'Leyendo archivo...' : 'Cargar Excel / CSV'}
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT / TABS ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* If no data uploaded yet, show Upload Hero Dropzone */}
        {normalizedRows.length === 0 ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center overflow-y-auto">
            <div 
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`max-w-2xl w-full p-12 border-2 border-dashed rounded-3xl flex flex-col items-center text-center cursor-pointer transition-all ${
                dragOver 
                ? 'border-teal-500 bg-teal-500/10 scale-102 shadow-2xl shadow-teal-900/20' 
                : 'border-slate-700 bg-slate-900/50 hover:bg-slate-900/80 hover:border-teal-500/50'
              }`}
            >
              <div className="w-20 h-20 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-4xl mb-6 text-teal-400 shadow-xl">
                📊
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {t.maintenanceUploadTitle || 'Cargar Archivo de Mantenimiento'}
              </h2>
              <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                {t.maintenanceUploadSubtitle || 'Arrastra un archivo Excel (.xlsx, .xls) o CSV con el reporte de mano de obra (Primavera, SAP PM, GMAO). El sistema detectará las columnas y te permitirá confirmar o reasignarlas.'}
              </p>

              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-mono text-slate-300 border border-slate-700">.XLSX</span>
                <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-mono text-slate-300 border border-slate-700">.XLS</span>
                <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-mono text-slate-300 border border-slate-700">.CSV</span>
              </div>

              <div className="mt-8 flex items-center gap-2 text-xs text-teal-400/90 font-medium">
                <span>✨ Auto-detección inteligente & memoria de cabeceras</span>
              </div>
            </div>

            {/* Past reports summary if exists */}
            {reportHistory.length > 0 && (
              <div className="max-w-2xl w-full mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>📜 Reportes Recientes Guardados</span>
                  <span className="text-teal-400">{reportHistory.length} disponibles</span>
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {reportHistory.map(rep => (
                    <div 
                      key={rep.id} 
                      onClick={() => handleRestoreReport(rep)}
                      className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 flex items-center justify-between cursor-pointer transition-all hover:border-teal-500/40"
                    >
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-white truncate">{rep.fileName}</p>
                        <p className="text-xs text-slate-400">{rep.periodLabel} • {new Date(rep.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteReport(rep.id, e)}
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Eliminar del historial"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Dashboard with loaded data */
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* ── FILTER & TAB BAR ── */}
            <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
              
              {/* Period Selector Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setPeriodType('semanal')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    periodType === 'semanal' 
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40' 
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📅 {t.maintenanceWeekly || 'Semanal'}
                </button>
                <button
                  onClick={() => setPeriodType('mensual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    periodType === 'mensual' 
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40' 
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🗓️ {t.maintenanceMonthly || 'Mensual'}
                </button>
                <button
                  onClick={() => setPeriodType('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    periodType === 'custom' 
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40' 
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚙️ {t.maintenanceCustom || 'Rango Personalizado'}
                </button>
              </div>

              {/* Custom Date Inputs if custom mode */}
              {periodType === 'custom' && (
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    value={customStart} 
                    onChange={e => setCustomStart(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                  <span className="text-slate-500 text-xs">hasta</span>
                  <input 
                    type="date" 
                    value={customEnd} 
                    onChange={e => setCustomEnd(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
              )}

              {/* Navigation View Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                {[
                  { id: 'overview', label: t.maintenanceTabOverview || 'Resumen & KPIs', icon: '📊' },
                  { id: 'workers', label: t.maintenanceTabWorkers || 'Por Trabajador', icon: '👷' },
                  { id: 'types', label: t.maintenanceTabTypes || 'Por Tipo OT', icon: '🔧' },
                  { id: 'assets', label: t.maintenanceTabAssets || 'Top Activos', icon: '🏭' },
                  { id: 'data', label: t.maintenanceTabData || 'Datos', icon: '📋' },
                  { id: 'report', label: t.maintenanceTabReport || 'Informe IA', icon: '🤖' },
                  { id: 'history', label: t.maintenanceTabHistory || 'Historial', icon: '📜' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      activeTab === tab.id
                      ? 'bg-slate-800 text-teal-400 border border-teal-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── KPI METRICS CARDS ── */}
            {stats && (
              <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 shrink-0">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.maintenanceUniqueOTs || 'OTs Únicas'}</p>
                  <p className="text-xl font-extrabold text-white mt-1">{stats.uniqueOTs}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Órdenes analizadas</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.maintenanceTotalHours || 'Horas Totales'}</p>
                  <p className="text-xl font-extrabold text-teal-400 mt-1">{stats.totalHoursFormatted}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{stats.totalHours}h decimales</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.maintenanceLaborRecords || 'Registros M.O.'}</p>
                  <p className="text-xl font-extrabold text-blue-400 mt-1">{stats.totalRecords}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Líneas de mano de obra</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.maintenanceWorkersCount || 'Técnicos Activos'}</p>
                  <p className="text-xl font-extrabold text-amber-400 mt-1">{stats.workers.length}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">En el período</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ratio Preventivo</p>
                  <p className="text-xl font-extrabold text-emerald-400 mt-1">{stats.preventiveRatio}%</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{stats.preventiveHours}h preventivas</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ratio Correctivo</p>
                  <p className="text-xl font-extrabold text-rose-400 mt-1">{stats.correctiveRatio}%</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{stats.correctiveHours}h correctivas</p>
                </div>
              </div>
            )}

            {/* ── TAB PANELS CONTENT ── */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && stats && (
                <div className="space-y-6 max-w-7xl mx-auto">
                  
                  {/* Period Banner & Quick AI Action */}
                  <div className="bg-gradient-to-r from-teal-900/40 via-slate-900 to-slate-900 border border-teal-500/30 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                    <div>
                      <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Período Seleccionado</span>
                      <h2 className="text-2xl font-black text-white mt-1">{stats.periodLabel}</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Cálculo exacto: {stats.uniqueOTs} OTs, {stats.totalHoursFormatted} horas de mano de obra y {stats.workers.length} técnicos.
                      </p>
                    </div>

                    <button
                      onClick={handleGenerateReport}
                      disabled={isGeneratingReport}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold shadow-lg shadow-teal-900/40 transition-all hover:scale-105 disabled:opacity-50"
                    >
                      <span>🤖</span>
                      <span>{isGeneratingReport ? 'Generando Informe...' : 'Generar Informe Ejecutivo IA'}</span>
                    </button>
                  </div>

                  {/* Risks and Alerts */}
                  {stats.topRisks.length > 0 && (
                    <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-5 space-y-2">
                      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <span>⚠️</span> Alertas Operativas y Vulnerabilidades Detectadas
                      </h3>
                      <ul className="space-y-1.5 text-xs text-amber-200/90 list-disc list-inside">
                        {stats.topRisks.map((risk, idx) => (
                          <li key={idx}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Two column visual stats */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Top Workers Breakdown */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>👷</span> Carga de Trabajo por Técnico
                        </h3>
                        <button onClick={() => setActiveTab('workers')} className="text-xs text-teal-400 hover:underline">Ver todos</button>
                      </div>

                      <div className="space-y-3">
                        {stats.workers.slice(0, 5).map(w => (
                          <div key={w.name} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-200">{w.name}</span>
                              <span className="text-slate-400">{w.hoursFormatted} ({w.percentOfTotal}%)</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div 
                                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-blue-500" 
                                style={{ width: `${Math.min(100, w.percentOfTotal)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Types of Maintenance Breakdown */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>🔧</span> Distribución por Tipo de OT
                        </h3>
                        <button onClick={() => setActiveTab('types')} className="text-xs text-teal-400 hover:underline">Ver todos</button>
                      </div>

                      <div className="space-y-3">
                        {stats.byType.map(t => (
                          <div key={t.name} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-200">{t.name}</span>
                              <span className="text-slate-400">{t.hoursFormatted} • {t.ots} OTs ({t.percentOfTotal}%)</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div 
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-500" 
                                style={{ width: `${Math.min(100, t.percentOfTotal)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Top Assets */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>🏭</span> Top Activos / Equipos más Intervenidos
                      </h3>
                      <button onClick={() => setActiveTab('assets')} className="text-xs text-teal-400 hover:underline">Ver ranking completo</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {stats.byAsset.slice(0, 6).map((a, idx) => (
                        <div key={a.name} className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">#{idx + 1}</span>
                            <span className="text-xs font-extrabold text-teal-400">{a.hoursFormatted}</span>
                          </div>
                          <p className="text-xs font-bold text-white mt-2 truncate" title={a.name}>{a.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{a.ots} OTs • {a.records} registros ({a.percentOfTotal}%)</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: WORKERS */}
              {activeTab === 'workers' && stats && (
                <div className="max-w-7xl mx-auto space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Desglose Detallado por Trabajador</h2>
                    <span className="text-xs text-slate-400">{stats.workers.length} técnicos registrados</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Trabajador</th>
                          <th className="p-3.5 text-center">OTs Atendidas</th>
                          <th className="p-3.5 text-center">Registros M.O.</th>
                          <th className="p-3.5 text-right">Horas Totales</th>
                          <th className="p-3.5 text-right">% Carga Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {stats.workers.map(w => (
                          <tr key={w.name} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-bold text-white flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-teal-600/20 text-teal-300 flex items-center justify-center text-xs">
                                {w.name.charAt(0)}
                              </span>
                              <span>{w.name}</span>
                            </td>
                            <td className="p-3.5 text-center text-slate-300 font-mono">{w.ots}</td>
                            <td className="p-3.5 text-center text-slate-300 font-mono">{w.records}</td>
                            <td className="p-3.5 text-right font-extrabold text-teal-400 font-mono">{w.hoursFormatted} ({w.hours}h)</td>
                            <td className="p-3.5 text-right text-slate-300 font-mono">{w.percentOfTotal}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: TYPES */}
              {activeTab === 'types' && stats && (
                <div className="max-w-7xl mx-auto space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Desglose por Tipo de Orden de Trabajo</h2>
                    <span className="text-xs text-slate-400">{stats.byType.length} tipos de trabajo</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Tipo de OT</th>
                          <th className="p-3.5 text-center">OTs Únicas</th>
                          <th className="p-3.5 text-center">Registros M.O.</th>
                          <th className="p-3.5 text-center">Tiempo Medio / Intervención</th>
                          <th className="p-3.5 text-right">Horas Totales</th>
                          <th className="p-3.5 text-right">% del Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {stats.byType.map(t => (
                          <tr key={t.name} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-bold text-white">{t.name}</td>
                            <td className="p-3.5 text-center text-slate-300 font-mono">{t.ots}</td>
                            <td className="p-3.5 text-center text-slate-300 font-mono">{t.records}</td>
                            <td className="p-3.5 text-center text-slate-400 font-mono">{t.avgFormatted}</td>
                            <td className="p-3.5 text-right font-extrabold text-teal-400 font-mono">{t.hoursFormatted} ({t.hours}h)</td>
                            <td className="p-3.5 text-right text-slate-300 font-mono">{t.percentOfTotal}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: ASSETS */}
              {activeTab === 'assets' && stats && (
                <div className="max-w-7xl mx-auto space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Ranking de Activos y Equipos más Demandantes</h2>
                    <span className="text-xs text-slate-400">Top {stats.byAsset.length} equipos</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5 text-center">#</th>
                          <th className="p-3.5">Activo / Equipo</th>
                          <th className="p-3.5 text-center">OTs Involucradas</th>
                          <th className="p-3.5 text-center">Intervenciones</th>
                          <th className="p-3.5 text-right">Horas Dedicadas</th>
                          <th className="p-3.5 text-right">% Tiempo Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {stats.byAsset.map((a, idx) => (
                          <tr key={a.name} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="p-3.5 font-bold text-white">{a.name}</td>
                            <td className="p-3.5 text-center text-slate-300 font-mono">{a.ots}</td>
                            <td className="p-3.5 text-center text-slate-300 font-mono">{a.records}</td>
                            <td className="p-3.5 text-right font-extrabold text-teal-400 font-mono">{a.hoursFormatted} ({a.hours}h)</td>
                            <td className="p-3.5 text-right text-slate-300 font-mono">{a.percentOfTotal}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: RAW DATA TABLE */}
              {activeTab === 'data' && (
                <div className="max-w-7xl mx-auto space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                      <input 
                        type="text" 
                        placeholder="Buscar por OT, trabajador, equipo, observaciones..." 
                        value={tableSearch}
                        onChange={e => { setTableSearch(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <span className="text-xs text-slate-400">
                      Mostrando {filteredRows.length} de {normalizedRows.length} registros
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl custom-scrollbar">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3">Fecha</th>
                          <th className="p-3">OT</th>
                          <th className="p-3">Tipo OT</th>
                          <th className="p-3">Activo</th>
                          <th className="p-3">Trabajador</th>
                          <th className="p-3 text-right">Tiempo</th>
                          <th className="p-3">Observaciones / Tarea</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {paginatedRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 text-slate-400 font-mono">{r.fechaInicio.toLocaleDateString()}</td>
                            <td className="p-3 font-bold text-teal-300 font-mono">{r.ot}</td>
                            <td className="p-3 text-slate-300">{r.tipoOT}</td>
                            <td className="p-3 text-white font-medium max-w-xs truncate" title={r.activo}>{r.activo}</td>
                            <td className="p-3 text-slate-200">{r.trabajador}</td>
                            <td className="p-3 text-right font-mono font-bold text-teal-400">{r.tiempoTotal}</td>
                            <td className="p-3 text-slate-400 max-w-md truncate" title={r.observaciones || r.descripcionTareas}>
                              {r.observaciones || r.descripcionTareas || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                    <span>Página {currentPage} de {totalPages}</span>
                    <div className="flex gap-1">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
                      >
                        Anterior
                      </button>
                      <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: AI EXECUTIVE REPORT */}
              {activeTab === 'report' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  
                  {/* Generation Control Bar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>🤖</span> Informe Ejecutivo de Mantenimiento con IA
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Generado a partir de estadísticas verificadas del período ({stats?.periodLabel}).
                        </p>
                      </div>

                      <button
                        onClick={handleGenerateReport}
                        disabled={isGeneratingReport}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-900/30 transition-all hover:scale-105 disabled:opacity-50"
                      >
                        <span>{isGeneratingReport ? 'Generando...' : narrativeReport ? 'Regenerar Informe' : 'Generar Informe'}</span>
                      </button>
                    </div>

                    {/* Custom Notes / Prompt Input */}
                    <div className="pt-2 border-t border-slate-800">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {t.maintenanceAdditionalNotes || 'Instrucciones adicionales para la IA (opcional)'}
                      </label>
                      <input 
                        type="text" 
                        value={additionalNotes}
                        onChange={e => setAdditionalNotes(e.target.value)}
                        placeholder={t.maintenanceNotesPlaceholder || 'Ej: Enfatizar la avería en la Línea 2 y proponer plan para reducir correctivos...'}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Report Display */}
                  {isGeneratingReport ? (
                    <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-bold text-white animate-pulse">Sintetizando métricas exactas y redactando informe ejecutivo industrial...</p>
                    </div>
                  ) : narrativeReport ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
                      
                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800 print:hidden">
                        <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Documento Markdown</span>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyMarkdown}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all"
                          >
                            <span>{copyFeedback ? '✅ Copiado' : '📋 Copiar MD'}</span>
                          </button>

                          <button
                            onClick={handleDownloadMarkdown}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all"
                          >
                            <span>💾 Descargar .md</span>
                          </button>

                          <button
                            onClick={handlePrintPdf}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-300 border border-slate-700 transition-all"
                          >
                            <span>🖨️ Imprimir / PDF</span>
                          </button>
                        </div>
                      </div>

                      {/* Rendered Text / Content */}
                      <div className="prose prose-invert max-w-none prose-headings:text-teal-300 prose-table:border prose-table:border-slate-800 prose-th:bg-slate-950 prose-th:p-2.5 prose-td:p-2.5 prose-td:border-b prose-td:border-slate-800 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-200">
                        {narrativeReport}
                      </div>

                    </div>
                  ) : (
                    <div className="p-12 bg-slate-900/50 border border-slate-800 rounded-2xl text-center">
                      <p className="text-sm text-slate-400">Haz clic en <strong>"Generar Informe"</strong> para redactar el análisis ejecutivo con Inteligencia Artificial.</p>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 7: REPORT HISTORY */}
              {activeTab === 'history' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <h2 className="text-lg font-bold text-white">Historial de Reportes Generados</h2>
                  
                  {reportHistory.length === 0 ? (
                    <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-sm text-slate-400">
                      No hay reportes previos en el historial.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reportHistory.map(rep => (
                        <div 
                          key={rep.id} 
                          onClick={() => handleRestoreReport(rep)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            activeReportId === rep.id 
                            ? 'bg-slate-800 border-teal-500/60 shadow-lg shadow-teal-950' 
                            : 'bg-slate-900 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <h3 className="text-sm font-bold text-white">{rep.fileName}</h3>
                            <p className="text-xs text-slate-400 mt-1">
                              Período: <strong className="text-teal-300">{rep.periodLabel}</strong> ({rep.periodType}) • Creado el {new Date(rep.createdAt).toLocaleString()}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {rep.stats.uniqueOTs} OTs • {rep.stats.totalHoursFormatted} • {rep.stats.workers.length} técnicos
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs px-3 py-1 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/20 font-semibold">
                              Abrir ↗
                            </span>
                            <button 
                              onClick={(e) => handleDeleteReport(rep.id, e)}
                              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Eliminar reporte"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* ── MODAL: CONFIRMACIÓN Y REASIGNACIÓN DE COLUMNAS ── */}
      {showMappingModal && parsedWorkbook && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] my-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xl border border-teal-500/30">
                  ⚙️
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {t.maintenanceMappingTitle || 'Confirmar y Asignar Columnas'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t.maintenanceMappingSubtitle || 'Verifica cómo corresponden las cabeceras de tu archivo a los campos del reporte.'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowMappingModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {/* Presets and Info Toolbar */}
            <div className="py-3 px-1 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Archivo detectado:</span>
                <span className="bg-slate-800 text-teal-300 font-mono px-2 py-0.5 rounded border border-slate-700">{fileName}</span>
                <span className="text-slate-500">({parsedWorkbook.totalRows} filas detectadas)</span>
              </div>

              {/* Preset Selector */}
              {presets.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Cargar Preset:</span>
                  <select
                    onChange={(e) => handleApplyPreset(e.target.value)}
                    defaultValue=""
                    className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2 py-1"
                  >
                    <option value="" disabled>Seleccionar preset guardado...</option>
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Mapping Field Rows List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MAINTENANCE_FIELDS.map(field => {
                  const selectedColumn = columnMapping[field.key] || '';
                  const source = mappingSources[field.key] || 'unmapped';

                  // Sample values from the currently selected column
                  const sampleValues = selectedColumn 
                    ? parsedWorkbook.sampleRows.map(row => row[selectedColumn]).filter(Boolean).slice(0, 2).join(' | ') 
                    : '';

                  return (
                    <div 
                      key={field.key} 
                      className={`p-3 rounded-2xl border transition-all ${
                        field.required && !selectedColumn 
                        ? 'bg-rose-950/20 border-rose-500/40' 
                        : selectedColumn 
                        ? 'bg-slate-950/70 border-slate-800' 
                        : 'bg-slate-950/30 border-slate-800/60 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{field.label}</span>
                          {field.required && <span className="text-rose-400 font-bold">*</span>}
                        </label>

                        {/* Status Badge */}
                        {source === 'saved_preference' && selectedColumn && (
                          <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
                            🔵 Preferencia guardada
                          </span>
                        )}
                        {source === 'auto_detected' && selectedColumn && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
                            🟢 Coincidencia auto
                          </span>
                        )}
                        {!selectedColumn && (
                          <span className="text-[10px] text-slate-500">
                            {field.required ? '⚠️ Requerido' : 'Opcional'}
                          </span>
                        )}
                      </div>

                      {/* Dropdown Select for Column Header */}
                      <select
                        value={selectedColumn}
                        onChange={(e) => {
                          const val = e.target.value;
                          setColumnMapping(prev => ({ ...prev, [field.key]: val }));
                          setMappingSources(prev => ({ ...prev, [field.key]: val ? 'auto_detected' : 'unmapped' }));
                        }}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500"
                      >
                        <option value="">-- No asignar / Ninguna --</option>
                        {parsedWorkbook.headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>

                      {/* Sample Preview Text */}
                      {selectedColumn && sampleValues && (
                        <p className="text-[10px] text-slate-400 mt-1 truncate font-mono">
                          Muestra: <span className="text-slate-300">{sampleValues}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
              
              {/* Save Preference Checkbox */}
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="savePrefCheck"
                  checked={saveAsDefaultPref}
                  onChange={e => setSaveAsDefaultPref(e.target.checked)}
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500 w-4 h-4 bg-slate-950 cursor-pointer"
                />
                <label htmlFor="savePrefCheck" className="text-xs text-slate-300 cursor-pointer select-none">
                  {t.maintenanceSavePreference || 'Guardar esta asignación como mi preferencia para futuros archivos'}
                </label>
              </div>

              {/* Confirm / Cancel Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleConfirmMapping}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-900/30 transition-all hover:scale-105"
                >
                  {t.maintenanceConfirmBtn || 'Confirmar y Analizar Datos'}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default MaintenanceReportTool;
