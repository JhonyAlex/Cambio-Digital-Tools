
import React, { useState, useEffect, useRef, useMemo } from 'react';
// REMOVED STATIC IMPORT: import { GoogleGenAI } from "@google/genai";
import { budgetService } from '../../services/budgetService';
import { payrollService } from '../../services/payrollService'; 
import { Budget, CatalogItem, BudgetLineItem, BudgetStatus, CurrencyCode, PayrollConfig, DocumentType, BudgetGlobalConfig } from '../../types';
import FinancialConfigModal from './FinancialConfigModal';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../hooks/useAppContext';

// --- HELPER COMPONENT: Simple Markdown Renderer ---
const BudgetMarkdownRenderer: React.FC<{ content: string; className?: string; isPrintMode?: boolean }> = ({ content, className = "", isPrintMode = false }) => {
  if (!content) return null;
  const colors = isPrintMode ? { text: "text-gray-700", bold: "text-gray-900", h3: "text-black border-gray-300", h4: "text-blue-900", h5: "text-indigo-900", listMarker: "marker:text-blue-600", num: "text-blue-800" } : { text: "text-slate-300", bold: "text-slate-200", h3: "text-white border-slate-700", h4: "text-cyan-400", h5: "text-indigo-300", listMarker: "marker:text-cyan-500", num: "text-cyan-500" };
  const parseBold = (text: string) => text.split(/(\*\*.*?\*\*)/g).map((part, index) => (part.startsWith('**') && part.endsWith('**')) ? <strong key={index} className={`font-bold ${colors.bold}`}>{part.slice(2, -2)}</strong> : part);
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  const flushList = (keyPrefix: number) => { if (currentList.length > 0) { renderedElements.push(<ul key={`ul-${keyPrefix}`} className={`list-disc pl-5 space-y-1 mb-4 ${colors.text} ${colors.listMarker}`}>{...currentList}</ul>); currentList = []; } };
  lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) { flushList(i); return; }
      if (trimmed.startsWith('# ')) { flushList(i); renderedElements.push(<h3 key={i} className={`text-lg font-bold mt-6 mb-3 uppercase tracking-wide border-b pb-2 ${colors.h3}`}>{parseBold(trimmed.slice(2))}</h3>); return; }
      if (trimmed.startsWith('## ')) { flushList(i); renderedElements.push(<h4 key={i} className={`text-base font-bold mt-5 mb-2 ${colors.h4}`}>{parseBold(trimmed.slice(3))}</h4>); return; }
      if (trimmed.startsWith('### ')) { flushList(i); renderedElements.push(<h5 key={i} className={`text-sm font-bold mt-3 mb-1 ${colors.h5}`}>{parseBold(trimmed.slice(4))}</h5>); return; }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) { currentList.push(<li key={i} className="pl-1 leading-relaxed">{parseBold(trimmed.slice(2))}</li>); return; }
      if (/^\d+\./.test(trimmed)) { flushList(i); const [num, ...rest] = trimmed.split('.'); renderedElements.push(<div key={i} className={`flex items-start gap-2 ml-1 mb-2 leading-relaxed ${colors.text}`}><span className={`font-bold min-w-[1.5em] ${colors.num}`}>{num}.</span><span>{parseBold(rest.join('.').trim())}</span></div>); return; }
      flushList(i); renderedElements.push(<p key={i} className={`mb-3 leading-relaxed text-justify ${colors.text}`}>{parseBold(trimmed)}</p>);
  });
  flushList(lines.length);
  return <div className={`text-sm ${className}`}>{renderedElements}</div>;
};

// ... (Rest of components: ProductAutocomplete, CategoryTagSelector - Unchanged)
const ProductAutocomplete: React.FC<{ value: string; onChange: (val: string) => void; catalog: CatalogItem[]; placeholder?: string; }> = ({ value, onChange, catalog, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const filtered = useMemo(() => (!value ? [] : catalog.filter(c => c.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8)), [value, catalog]);
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false); }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
    const handleSelect = (name: string) => { onChange(name); setIsOpen(false); };
    return (
        <div className="relative w-full" ref={wrapperRef}>
            <input type="text" className="w-full bg-transparent border-b border-transparent focus:border-cyan-500 outline-none text-white placeholder-slate-600" value={value} onChange={(e) => { onChange(e.target.value); setIsOpen(true); setHighlightedIndex(0); }} onFocus={() => setIsOpen(true)} placeholder={placeholder} />
            {isOpen && filtered.length > 0 && (<ul className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">{filtered.map((item, idx) => (<li key={item.id} onClick={() => handleSelect(item.name)} className={`px-3 py-2 text-sm cursor-pointer transition-colors flex justify-between ${idx === highlightedIndex ? 'bg-cyan-900/30 text-white' : 'text-slate-300 hover:bg-slate-700'}`}><span>{item.name}</span><span className="text-xs text-slate-500">{item.currency} {item.unitPrice}</span></li>))}</ul>)}
        </div>
    );
};

const CategoryTagSelector: React.FC<{ value: string; onChange: (val: string) => void; catalog: CatalogItem[]; }> = ({ value, onChange, catalog }) => {
    const uniqueCategories = useMemo(() => Array.from(new Set(catalog.map(c => c.category).filter(Boolean))).sort(), [catalog]);
    return (<div className="space-y-2"><label className="text-xs text-slate-500 font-bold block">Categoría / Etiqueta</label><input type="text" placeholder="Escribe o selecciona..." className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 outline-none" value={value} onChange={e => onChange(e.target.value)} /><div className="flex flex-wrap gap-2 mt-2">{uniqueCategories.map(cat => (<button key={cat} onClick={() => onChange(cat)} className={`text-[10px] px-2 py-1 rounded-full border transition-all ${value === cat ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}>{cat}</button>))}</div></div>);
};

const BudgetTool: React.FC = () => {
  const { apiConfig } = useAppContext();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'editor' | 'catalog'>('dashboard');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [financialConfig, setFinancialConfig] = useState<PayrollConfig | null>(null);
  const [budgetConfig, setBudgetConfig] = useState<BudgetGlobalConfig | null>(null);
  const [isCompanyConfigOpen, setIsCompanyConfigOpen] = useState(false);
  const [companyConfigForm, setCompanyConfigForm] = useState<BudgetGlobalConfig>({ companyName: '', companyNit: '', companyAddress: '', companyCity: '', companyPhone: '', companyEmail: '', defaultTerms: '' });
  const [currentBudget, setCurrentBudget] = useState<Partial<Budget>>({ items: [], taxRate: 0, discount: 0, status: 'draft', documentType: 'budget', presentationCurrency: 'COP', date: Date.now(), customTermsInstruction: '' });
  const [isDirty, setIsDirty] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isGeneratingTerms, setIsGeneratingTerms] = useState(false);
  const [showCustomTermsInput, setShowCustomTermsInput] = useState(false);
  const [catalogForm, setCatalogForm] = useState<Partial<CatalogItem> & { margin?: number }>({ currency: 'COP', margin: 0 });
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState<{ isOpen: boolean; showCosts: boolean; budget: Budget | null }>({ isOpen: false, showCosts: false, budget: null });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [isDirty]);
  useEffect(() => { if (isEditingNotes && notesTextareaRef.current) notesTextareaRef.current.focus(); }, [isEditingNotes]);

  const loadData = async () => { const b = await budgetService.getBudgets(); const c = await budgetService.getCatalog(); const g = await budgetService.getGlobalConfig(); const f = await payrollService.getConfig(); setBudgets(b.sort((a,b) => b.updatedAt - a.updatedAt)); setCatalog(c.sort((a,b) => a.name.localeCompare(b.name))); setBudgetConfig(g); setCompanyConfigForm(g); setFinancialConfig(f); };
  const handleSaveCompanyConfig = async () => { await budgetService.saveGlobalConfig(companyConfigForm); setBudgetConfig(companyConfigForm); setIsCompanyConfigOpen(false); };
  const handleSaveConfig = async (newConfig: PayrollConfig) => { await payrollService.saveConfig(newConfig); setFinancialConfig(newConfig); };
  const translateStatus = (s: string) => ({'draft':'Borrador','sent':'Enviado','accepted':'Aceptado','rejected':'Rechazado'}[s]||s);
  const getDocumentTypeLabel = (t: DocumentType) => ({'proposal':'Propuesta Comercial','budget':'Presupuesto','receivable':'Cuenta de Cobro','invoice':'Factura de Venta'}[t]||'Documento');
  const getDocumentColor = (type?: DocumentType) => { switch(type) { case 'proposal': return 'text-blue-400 border-blue-500/30 bg-blue-900/10'; case 'budget': return 'text-cyan-400 border-cyan-500/30 bg-cyan-900/10'; case 'receivable': return 'text-violet-400 border-violet-500/30 bg-violet-900/10'; case 'invoice': return 'text-slate-200 border-slate-500/30 bg-slate-800'; default: return 'text-slate-400 border-slate-700 bg-slate-900'; } };
  const requestTabChange = (newTab: typeof activeTab) => { if (isDirty && activeTab === 'editor') { if (!confirm("⚠️ Cambios sin guardar. ¿Salir?")) return; } setIsDirty(false); setActiveTab(newTab); };
  const handleEditBudget = (b: Budget) => { setCurrentBudget(JSON.parse(JSON.stringify(b))); setActiveTab('editor'); setIsEditingNotes(false); setShowCustomTermsInput(!!b.customTermsInstruction); setIsDirty(false); };
  const handleNewBudget = () => { setCurrentBudget({ id: '', clientName: '', projectName: '', clientAddress: '', clientCity: '', clientNit: '', createdBy: user?.displayName || '', items: [], taxRate: 0, discount: 0, status: 'draft', documentType: 'budget', presentationCurrency: 'COP', date: Date.now(), validUntil: Date.now() + (30 * 86400000), customTermsInstruction: '', notes: budgetConfig?.defaultTerms || '' }); setActiveTab('editor'); setIsEditingNotes(false); setShowCustomTermsInput(false); setIsDirty(false); };
  
  const handleDuplicateBudget = async (id: string) => { if(confirm("¿Duplicar este documento?")) { setIsDuplicating(true); try { const newBudget = await budgetService.duplicateBudget(id); await loadData(); handleEditBudget(newBudget); } catch (e) { alert("Error al duplicar: " + e); } finally { setIsDuplicating(false); } } };
  const handleDeleteBudget = async (id: string) => { if(confirm("¿Eliminar este documento permanentemente?")) { setIsDeleting(true); try { await budgetService.deleteBudget(id); await loadData(); if(activeTab === 'editor') setActiveTab('dashboard'); } catch (e) { alert("Error al eliminar"); } finally { setIsDeleting(false); } } };

  const updateBudgetField = (f: keyof Budget, v: any) => { setCurrentBudget(prev => ({ ...prev, [f]: v })); setIsDirty(true); };
  const handleSaveBudget = async () => { if (!currentBudget.clientName || !currentBudget.items?.length) return alert("Falta el Cliente o Ítems para guardar."); setIsSaving(true); try { const budgetToSave: Budget = { ...currentBudget as Budget, id: currentBudget.id || crypto.randomUUID(), createdAt: currentBudget.createdAt || Date.now(), updatedAt: Date.now() }; await budgetService.saveBudget(budgetToSave); await loadData(); setIsDirty(false); if (!currentBudget.id) { setCurrentBudget(budgetToSave); } else { setActiveTab('dashboard'); } } catch (e) { alert("Error guardando"); } finally { setIsSaving(false); } };
  
  const toCOP = (amount: number, cur: CurrencyCode) => { const r = financialConfig?.euroExchangeRate||4500; const u = financialConfig?.usdExchangeRate||4000; return cur==='EUR'?amount*r : cur==='USD'?amount*u : amount; };
  const fromCOP = (amount: number, target: CurrencyCode) => { const r = financialConfig?.euroExchangeRate||4500; const u = financialConfig?.usdExchangeRate||4000; return target==='EUR'?amount/r : target==='USD'?amount/u : amount; };
  const handlePresentationCurrencyChange = (newC: CurrencyCode) => { const oldC = currentBudget.presentationCurrency || 'COP'; const newItems = currentBudget.items?.map(i => ({ ...i, unitPrice: fromCOP(toCOP(i.unitPrice, oldC), newC), unitCost: fromCOP(toCOP(i.unitCost, oldC), newC), currency: newC })); const newDisc = fromCOP(toCOP(currentBudget.discount||0, oldC), newC); setCurrentBudget({ ...currentBudget, presentationCurrency: newC, items: newItems, discount: newDisc }); setIsDirty(true); };
  
  const handleAddItem = () => { setCurrentBudget({ ...currentBudget, items: [...(currentBudget.items || []), { id: crypto.randomUUID(), name: '', quantity: 1, unitCost: 0, unitPrice: 0, currency: currentBudget.presentationCurrency || 'COP' }] }); setIsDirty(true); };
  const handleUpdateItem = (idx: number, f: keyof BudgetLineItem | 'margin', v: any) => { const items = [...(currentBudget.items || [])]; let item = { ...items[idx] }; if (f === 'unitCost') { item.unitCost = Number(v); item.unitPrice = Number(v) * (1 + (item.unitCost > 0 ? ((item.unitPrice - item.unitCost) / item.unitCost) : 0)); } else if (f === 'unitPrice') { item.unitPrice = Number(v); } else if (f === 'margin') { item.unitPrice = item.unitCost * (1 + (Number(v) / 100)); } else { item = { ...item, [f]: v }; } if (f === 'name') { const m = catalog.find(c => c.name.toLowerCase() === String(v).toLowerCase()); if (m) { const cur = currentBudget.presentationCurrency || 'COP'; item.unitPrice = fromCOP(toCOP(m.unitPrice, m.currency), cur); item.unitCost = fromCOP(toCOP(m.unitCost, m.currency), cur); item.currency = cur; item.catalogItemId = m.id; } } items[idx] = item; setCurrentBudget({ ...currentBudget, items }); setIsDirty(true); };
  const handleSaveLineToCatalog = async (item: BudgetLineItem) => { if (!item.name || item.unitPrice <= 0) return; const ex = catalog.find(c => c.name.toLowerCase() === item.name.toLowerCase()); const n: CatalogItem = { id: ex?.id||crypto.randomUUID(), name: item.name, description: ex?.description||'', unitCost: item.unitCost, unitPrice: item.unitPrice, currency: item.currency||'COP', category: ex?.category||'General' }; if (confirm(ex ? "Actualizar catálogo?" : "Guardar en catálogo?")) { await budgetService.saveCatalogItem(n); await loadData(); } };
  const handleRemoveItem = (i: number) => { const n = [...(currentBudget.items || [])]; n.splice(i, 1); setCurrentBudget({ ...currentBudget, items: n }); setIsDirty(true); };
  const handleDragStart = (e: React.DragEvent, i: number) => { setDraggedItemIndex(i); e.dataTransfer.effectAllowed = "move"; };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => { e.preventDefault(); if (draggedItemIndex === null || draggedItemIndex === dropIndex) return; const n = [...(currentBudget.items || [])]; const item = n[draggedItemIndex]; n.splice(draggedItemIndex, 1); n.splice(dropIndex, 0, item); setCurrentBudget({ ...currentBudget, items: n }); setIsDirty(true); setDraggedItemIndex(null); };

  const handleGenerateTerms = async () => { 
      if (!currentBudget.items?.length) return alert("Agrega ítems."); 
      if (!apiConfig.apiKey) return alert("Falta API Key."); 
      setIsGeneratingTerms(true); 
      try { 
          // DYNAMIC IMPORT
          // @ts-ignore
          const { GoogleGenAI } = await import("@google/genai");
          
          const ai = new GoogleGenAI({ apiKey: apiConfig.apiKey }); 
          const prompt = `Actúa como asistente legal. Genera Términos y Condiciones en Markdown para un ${getDocumentTypeLabel(currentBudget.documentType||'budget')}. Cliente: ${currentBudget.clientName}. Empresa: ${budgetConfig?.companyName}. Valor: ${formatMoney(calculateTotals(currentBudget.items||[],0,0,currentBudget.presentationCurrency||'COP').total, currentBudget.presentationCurrency)}. Items: ${currentBudget.items?.map(i=>i.name).join(', ')}. Reglas: ${financialConfig?.termsGuidelines||budgetConfig?.defaultTerms}. Extra: ${currentBudget.customTermsInstruction}. Sin saludos.`; 
          const r = await ai.models.generateContent({ model: apiConfig.models.complex||'gemini-3-flash-preview', contents: { parts: [{ text: prompt }] } }); 
          setCurrentBudget(p => ({ ...p, notes: (p.notes ? p.notes + "\n\n---\n\n" : "") + (r.text || "") })); 
          setIsDirty(true); 
          setIsEditingNotes(true); 
      } catch (e: any) { 
          alert("Error IA: " + e.message); 
      } finally { 
          setIsGeneratingTerms(false); 
      } 
  };

  const handleCatalogFormChange = (f: keyof CatalogItem | 'margin', v: any) => { const u: any = { [f]: v }; const c = f==='unitCost'?Number(v):(catalogForm.unitCost||0); const p = f==='unitPrice'?Number(v):(catalogForm.unitPrice||0); const m = f==='margin'?Number(v):(catalogForm.margin||0); if (f==='unitCost') u.unitPrice = Number(v)*(1+(m/100)); else if (f==='unitPrice' && c>0) u.margin = parseFloat((((Number(v)-c)/c)*100).toFixed(2)); else if (f==='margin') u.unitPrice = c*(1+(Number(v)/100)); setCatalogForm(p => ({ ...p, ...u })); };
  const handleOpenCatalogModal = (item?: CatalogItem) => { if (item) { const m = item.unitCost > 0 ? ((item.unitPrice - item.unitCost) / item.unitCost) * 100 : 0; setCatalogForm({ ...item, margin: parseFloat(m.toFixed(2)) }); } else { setCatalogForm({ currency: 'COP', margin: 0, unitCost: 0, unitPrice: 0 }); } setIsCatalogModalOpen(true); };
  const handleSaveCatalogItem = async () => { if(!catalogForm.name) return; const i: CatalogItem = { id: catalogForm.id||crypto.randomUUID(), name: catalogForm.name, description: catalogForm.description||'', unitCost: Number(catalogForm.unitCost)||0, unitPrice: Number(catalogForm.unitPrice)||0, currency: catalogForm.currency||'COP', category: catalogForm.category||'General' }; await budgetService.saveCatalogItem(i); await loadData(); setIsCatalogModalOpen(false); };
  const handleDeleteCatalogItem = async (id: string) => { if(confirm("¿Eliminar?")) { await budgetService.deleteCatalogItem(id); await loadData(); } };

  const calculateTotals = (items: BudgetLineItem[], tax: number, disc: number, cur: CurrencyCode) => { let s = 0, c = 0; items.forEach(i => { s += toCOP(i.unitPrice * i.quantity, i.currency||'COP'); c += toCOP(i.unitCost * i.quantity, i.currency||'COP'); }); const t = s * tax; const d = toCOP(disc, cur); const tot = s + t - d; const gm = s - c; return { subtotal: fromCOP(s, cur), taxAmount: fromCOP(t, cur), total: fromCOP(tot, cur), totalCost: fromCOP(c, cur), grossMargin: fromCOP(gm, cur) }; };
  const formatMoney = (a: number, c: CurrencyCode | undefined) => a.toLocaleString(c==='COP'?'es-CO':c==='USD'?'en-US':'es-ES', { style: 'currency', currency: c||'COP', maximumFractionDigits: c==='COP'?0:2 });
  const getRowMargin = (c: number, p: number) => (!c || c === 0) ? 0 : ((p - c) / c) * 100;

  return (
    <div className="h-full flex flex-col bg-[#0f172a]">
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md shrink-0 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="bg-cyan-600 p-1.5 rounded-lg text-white">DOC</span>
                Gestor de Documentos
                <button onClick={() => setIsCompanyConfigOpen(true)} className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800" title="Datos Empresa">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                </button>
            </h1>
            <p className="text-cyan-500/80 font-medium text-sm">Cotizaciones, Facturación y Rentabilidad</p>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-xl">
           <button onClick={() => requestTabChange('dashboard')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'dashboard' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Listado</button>
           <button onClick={handleNewBudget} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'editor' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>+ Nuevo</button>
           <button onClick={() => requestTabChange('catalog')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'catalog' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Catálogo</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
          {activeTab === 'dashboard' && (
              <div className="animate-in fade-in">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm text-slate-400">
                          <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500"><tr><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Proyecto / Cliente</th><th className="px-6 py-4 text-center">Estado</th><th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-center">Acciones</th></tr></thead>
                          <tbody className="divide-y divide-slate-800">
                              {budgets.length === 0 ? ( <tr><td colSpan={5} className="p-8 text-center italic">No hay documentos.</td></tr> ) : (
                                  budgets.map(b => {
                                      const { total } = calculateTotals(b.items, b.taxRate, b.discount, b.presentationCurrency||'COP');
                                      return (
                                          <tr key={b.id} onClick={() => handleEditBudget(b)} className="hover:bg-slate-800/30 cursor-pointer">
                                              <td className="px-6 py-4"><span className={`text-[10px] px-2 py-1 rounded font-bold uppercase border ${getDocumentColor(b.documentType)}`}>{getDocumentTypeLabel(b.documentType||'budget')}</span></td>
                                              <td className="px-6 py-4"><div className="font-bold text-white text-base">{b.projectName || b.clientName}</div><div className="text-xs text-slate-500">{b.projectName ? b.clientName : new Date(b.date).toLocaleDateString()}</div></td>
                                              <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded text-xs uppercase font-bold border ${b.status === 'accepted' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{translateStatus(b.status)}</span></td>
                                              <td className="px-6 py-4 text-right font-mono text-cyan-400">{formatMoney(total, b.presentationCurrency)}</td>
                                              <td className="px-6 py-4 text-center flex justify-center gap-2">
                                                  <button onClick={(e) => { e.stopPropagation(); setPrintPreview({ isOpen: true, budget: b, showCosts: false }); }} className="p-1.5 hover:text-white hover:bg-slate-700 rounded" title="Imprimir">🖨️</button>
                                                  <button onClick={(e) => { e.stopPropagation(); handleDuplicateBudget(b.id); }} className="p-1.5 text-amber-400 hover:text-white hover:bg-slate-700 rounded" title="Duplicar">📑</button>
                                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteBudget(b.id); }} className="p-1.5 text-red-400 hover:text-white hover:bg-slate-700 rounded" title="Eliminar">✕</button>
                                              </td>
                                          </tr>
                                      );
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {activeTab === 'catalog' && (
              <div className="animate-in fade-in">
                  <div className="flex justify-end mb-4"><button onClick={() => { setCatalogForm({ currency: 'COP', margin: 0 }); setIsCatalogModalOpen(true); }} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-bold">+ Nuevo</button></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {catalog.map(item => (
                          <div key={item.id} onClick={() => handleOpenCatalogModal(item)} className="bg-slate-900 border border-slate-800 p-4 rounded-xl hover:border-cyan-500/50 transition-colors group cursor-pointer">
                              <div className="flex justify-between items-start mb-2"><h3 className="font-bold text-white text-lg">{item.name}</h3><button onClick={(e) => { e.stopPropagation(); handleDeleteCatalogItem(item.id); }} className="text-red-400 hover:text-white opacity-0 group-hover:opacity-100">✕</button></div>
                              <p className="text-slate-500 text-sm mb-3 h-10 overflow-hidden">{item.description}</p>
                              <div className="bg-slate-950 p-2 rounded flex justify-between items-center text-sm"><div><span className="text-xs text-slate-500 block">Costo</span><span className="text-amber-500 font-mono">{formatMoney(item.unitCost, item.currency)}</span></div><div className="text-right"><span className="text-xs text-slate-500 block">Venta</span><span className="text-emerald-400 font-mono font-bold">{formatMoney(item.unitPrice, item.currency)}</span></div></div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {activeTab === 'editor' && (
              <div className="animate-in fade-in bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-6">
                  {/* EDITOR ACTIONS HEADER */}
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-6 border-b border-slate-800 pb-4 sticky top-0 bg-slate-900 z-10 pt-2">
                      <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded text-xs font-bold uppercase border ${getDocumentColor(currentBudget.documentType)}`}>
                              {getDocumentTypeLabel(currentBudget.documentType||'budget')}
                          </span>
                          {isDirty && <span className="text-amber-400 text-xs italic animate-pulse">● Cambios sin guardar</span>}
                      </div>
                      
                      {currentBudget.id ? (
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => setPrintPreview({ isOpen: true, budget: currentBudget as Budget, showCosts: false })} 
                                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors shadow-sm"
                                  title="Vista previa e imprimir"
                              >
                                  🖨️ Imprimir
                              </button>
                              <button 
                                  onClick={() => handleDuplicateBudget(currentBudget.id!)} 
                                  disabled={isDuplicating || isSaving}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-lg border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
                                  title="Crear copia editable"
                              >
                                  {isDuplicating ? '...' : '📑 Duplicar'}
                              </button>
                              <button 
                                  onClick={() => handleDeleteBudget(currentBudget.id!)} 
                                  disabled={isDeleting || isSaving}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-red-900/30 text-red-400 text-xs font-bold rounded-lg border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
                              >
                                  {isDeleting ? '...' : '✕ Eliminar'}
                              </button>
                          </div>
                      ) : (
                          <div className="text-xs text-slate-500 italic">Guardar para habilitar acciones</div>
                      )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 pb-6 border-b border-slate-800">
                      <div><label className="text-xs text-cyan-400 font-bold uppercase block mb-1">Documento</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-bold" value={currentBudget.documentType || 'budget'} onChange={e => updateBudgetField('documentType', e.target.value)}><option value="proposal">Propuesta</option><option value="budget">Presupuesto</option><option value="invoice">Factura</option></select></div>
                      <div className="md:col-span-1"><label className="text-xs text-slate-500 font-bold uppercase block mb-1">Proyecto</label><input type="text" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={currentBudget.projectName || ''} onChange={e => updateBudgetField('projectName', e.target.value)} /></div>
                      <div><label className="text-xs text-slate-500 font-bold uppercase block mb-1">Estado</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={currentBudget.status} onChange={e => updateBudgetField('status', e.target.value)}><option value="draft">Borrador</option><option value="sent">Enviado</option><option value="accepted">Aceptado</option></select></div>
                      <div className="flex items-end justify-end"><div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-700"><label className="text-xs text-slate-400 font-bold uppercase">Moneda:</label><select className="bg-transparent text-white font-bold outline-none text-sm cursor-pointer" value={currentBudget.presentationCurrency || 'COP'} onChange={e => handlePresentationCurrencyChange(e.target.value as CurrencyCode)}><option value="COP">COP</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div></div>
                  </div>

                  <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                      <div><label className="text-[10px] text-slate-400 block mb-1">Cliente</label><input type="text" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm" value={currentBudget.clientName} onChange={e => updateBudgetField('clientName', e.target.value)} /></div>
                      <div><label className="text-[10px] text-slate-400 block mb-1">NIT</label><input type="text" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm" value={currentBudget.clientNit || ''} onChange={e => updateBudgetField('clientNit', e.target.value)} /></div>
                      <div><label className="text-[10px] text-slate-400 block mb-1">Email</label><input type="email" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm" value={currentBudget.clientEmail || ''} onChange={e => updateBudgetField('clientEmail', e.target.value)} /></div>
                  </div>

                  <div className="overflow-x-auto mb-6 border border-slate-800 rounded-lg">
                      <table className="w-full text-sm text-left text-slate-400">
                          <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500"><tr><th className="w-8"></th><th className="px-4 py-3">Item</th><th className="px-4 py-3 w-20">Cant.</th><th className="px-4 py-3 w-32 text-right">Costo</th><th className="px-4 py-3 w-24 text-right">% Mg</th><th className="px-4 py-3 w-32 text-right">Precio</th><th className="px-4 py-3 w-32 text-right">Total</th><th className="w-10"></th></tr></thead>
                          <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                              {currentBudget.items?.map((item, idx) => (
                                  <tr key={idx} draggable onDragStart={(e) => handleDragStart(e, idx)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, idx)} className="hover:bg-slate-900">
                                      <td className="text-center cursor-grab">⋮⋮</td>
                                      <td className="px-4 py-2"><div className="flex gap-2"><ProductAutocomplete value={item.name} onChange={(v) => handleUpdateItem(idx, 'name', v)} catalog={catalog} />{item.name && <button onClick={() => handleSaveLineToCatalog(item)} className="p-1 text-slate-600 hover:text-amber-400">💾</button>}</div></td>
                                      <td className="px-4 py-2"><input type="number" className="w-full bg-transparent text-center text-white outline-none" value={item.quantity} onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))} /></td>
                                      <td className="px-4 py-2"><input type="number" className="w-full bg-transparent text-right text-amber-500 outline-none" value={item.unitCost} onChange={e => handleUpdateItem(idx, 'unitCost', Number(e.target.value))} /></td>
                                      <td className="px-4 py-2"><input type="number" className="w-full bg-transparent text-right text-blue-400 outline-none" value={parseFloat(getRowMargin(item.unitCost, item.unitPrice).toFixed(2))} onChange={e => handleUpdateItem(idx, 'margin', Number(e.target.value))} /></td>
                                      <td className="px-4 py-2"><input type="number" className="w-full bg-transparent text-right text-emerald-400 outline-none font-bold" value={item.unitPrice} onChange={e => handleUpdateItem(idx, 'unitPrice', Number(e.target.value))} /></td>
                                      <td className="px-4 py-2 text-right font-bold text-white">{formatMoney(item.unitPrice * item.quantity, currentBudget.presentationCurrency)}</td>
                                      <td className="px-4 py-2 text-center"><button onClick={() => handleRemoveItem(idx)} className="text-red-500">✕</button></td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      <button onClick={handleAddItem} className="w-full py-2 bg-slate-800 text-slate-400 hover:text-white font-bold">+ Agregar Línea</button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-8">
                      <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <div className="flex justify-between mb-3"><div className="flex gap-2"><label className="text-xs text-slate-500 font-bold uppercase">Notas / IA</label><button onClick={handleGenerateTerms} disabled={isGeneratingTerms} className="px-2 py-1 bg-indigo-900/30 text-indigo-400 text-[10px] rounded border border-indigo-500/30">{isGeneratingTerms ? '...' : '✨ Generar'}</button><button onClick={() => setShowCustomTermsInput(!showCustomTermsInput)} className="px-2 py-1 text-slate-500 text-[10px] border border-slate-700 rounded">Instr.</button></div><button onClick={() => setIsEditingNotes(!isEditingNotes)} className="text-[10px] text-slate-500">Editar</button></div>
                          {showCustomTermsInput && <textarea className="w-full bg-slate-900 border border-indigo-500/50 rounded p-2 text-xs text-white mb-2" placeholder="Instrucciones extra para la IA..." value={currentBudget.customTermsInstruction || ''} onChange={(e) => updateBudgetField('customTermsInstruction', e.target.value)} />}
                          {isEditingNotes ? <textarea ref={notesTextareaRef} className="w-full bg-slate-900 border border-cyan-500/50 rounded p-3 text-slate-200 outline-none h-40 font-mono text-sm" value={currentBudget.notes} onChange={e => { setCurrentBudget({...currentBudget, notes: e.target.value}); setIsDirty(true); }} /> : <div onClick={() => setIsEditingNotes(true)} className="h-40 bg-slate-900/50 border border-transparent hover:border-slate-700 rounded p-4 overflow-y-auto cursor-text"><BudgetMarkdownRenderer content={currentBudget.notes || ''} /></div>}
                      </div>
                      <div className="w-full md:w-72 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                          {(() => { const totals = calculateTotals(currentBudget.items||[], currentBudget.taxRate||0, currentBudget.discount||0, currentBudget.presentationCurrency||'COP'); return (<><div className="flex justify-between text-sm text-slate-400"><span>Subtotal:</span> <span>{formatMoney(totals.subtotal, currentBudget.presentationCurrency)}</span></div><div className="flex justify-between text-sm text-slate-400 items-center"><span>IVA (%):</span> <input type="number" className="w-12 bg-slate-900 border border-slate-700 rounded text-right text-xs text-white" value={(currentBudget.taxRate||0)*100} onChange={e => { setCurrentBudget({...currentBudget, taxRate: Number(e.target.value)/100}); setIsDirty(true); }} /></div><div className="flex justify-between text-sm text-slate-400 items-center"><span>Descuento:</span> <input type="number" className="w-20 bg-slate-900 border border-slate-700 rounded text-right text-xs text-white" value={currentBudget.discount} onChange={e => { setCurrentBudget({...currentBudget, discount: Number(e.target.value)}); setIsDirty(true); }} /></div><div className="border-t border-slate-800 my-2"></div><div className="flex justify-between text-lg font-bold text-white"><span>Total:</span> <span>{formatMoney(totals.total, currentBudget.presentationCurrency)}</span></div><div className="mt-4 pt-2 border-t border-slate-800 border-dashed text-xs text-amber-500 flex justify-between"><span>Costo:</span> <span>{formatMoney(totals.totalCost, currentBudget.presentationCurrency)}</span></div><div className="text-xs text-emerald-600 font-bold flex justify-between"><span>Ganancia:</span> <span>{formatMoney(totals.grossMargin, currentBudget.presentationCurrency)}</span></div></>); })()}
                      </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6"><button onClick={() => requestTabChange('dashboard')} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button><button onClick={handleSaveBudget} disabled={isSaving || !isDirty} className={`px-6 py-2 text-white rounded font-bold shadow-lg ${isDirty ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-700 opacity-70'}`}>{isSaving ? 'Guardando...' : 'Guardar'}</button></div>
              </div>
          )}

          {isCatalogModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                  <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl">
                      <h3 className="text-xl font-bold text-white mb-4">Item Catálogo</h3>
                      <div className="space-y-4">
                          <input type="text" placeholder="Nombre" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white" value={catalogForm.name || ''} onChange={e => setCatalogForm({...catalogForm, name: e.target.value})} />
                          <select className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white" value={catalogForm.currency || 'COP'} onChange={e => setCatalogForm({...catalogForm, currency: e.target.value as CurrencyCode})}><option value="COP">COP</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
                          <div className="grid grid-cols-3 gap-3">
                              <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-xs" value={catalogForm.unitCost || ''} onChange={e => handleCatalogFormChange('unitCost', e.target.value)} placeholder="Costo" />
                              <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-blue-400 font-bold text-xs" value={catalogForm.margin || ''} onChange={e => handleCatalogFormChange('margin', e.target.value)} placeholder="%" />
                              <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-emerald-400 font-bold text-xs" value={catalogForm.unitPrice || ''} onChange={e => handleCatalogFormChange('unitPrice', e.target.value)} placeholder="Precio" />
                          </div>
                          <CategoryTagSelector value={catalogForm.category || ''} onChange={(val) => setCatalogForm({...catalogForm, category: val})} catalog={catalog} />
                      </div>
                      <div className="flex justify-end gap-3 mt-6"><button onClick={() => setIsCatalogModalOpen(false)} className="text-slate-400">Cancel</button><button onClick={handleSaveCatalogItem} className="bg-cyan-600 text-white px-4 py-2 rounded font-bold">Guardar</button></div>
                  </div>
              </div>
          )}

          {financialConfig && <FinancialConfigModal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} config={financialConfig} onSave={handleSaveConfig} />}
          {isCompanyConfigOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"><div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl"><h3 className="text-xl font-bold text-white mb-4">Empresa</h3><div className="space-y-4"><input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={companyConfigForm.companyName} onChange={e => setCompanyConfigForm({...companyConfigForm, companyName: e.target.value})} placeholder="Nombre" /><textarea className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white h-32" value={companyConfigForm.defaultTerms} onChange={e => setCompanyConfigForm({...companyConfigForm, defaultTerms: e.target.value})} placeholder="Términos default..." /></div><div className="flex justify-end gap-3 mt-4"><button onClick={() => setIsCompanyConfigOpen(false)} className="text-slate-400">Cancel</button><button onClick={handleSaveCompanyConfig} className="bg-cyan-600 text-white px-4 py-2 rounded">Guardar</button></div></div></div>}
          
          {printPreview.isOpen && printPreview.budget && (
              <div className="fixed inset-0 z-[100] bg-white text-slate-900 flex flex-col h-screen w-screen overflow-hidden">
                  <div className="bg-slate-900 p-4 flex justify-between items-center print:hidden shadow-xl shrink-0">
                      <h3 className="text-white font-bold">Vista Previa</h3>
                      <div className="flex gap-3"><button onClick={() => window.print()} className="px-4 py-2 bg-cyan-600 text-white rounded font-bold">Imprimir</button><button onClick={() => setPrintPreview({ isOpen: false, showCosts: false, budget: null })} className="px-4 py-2 bg-red-600 text-white rounded">Cerrar</button></div>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-gray-100 p-8 print:p-0"><div className="max-w-4xl mx-auto bg-white p-12 shadow-xl print:shadow-none min-h-[1123px] text-sm print:text-black"><h1 className="text-3xl font-bold mb-4">{budgetConfig?.companyName}</h1><div className="mb-8"><h2 className="text-xl font-bold uppercase">{getDocumentTypeLabel(printPreview.budget.documentType||'budget')}</h2><p>#{printPreview.budget.id.substring(0,8)}</p></div><table className="w-full mb-8 text-left"><thead><tr className="border-b-2 border-gray-800"><th>Item</th><th className="text-center">Cant</th><th className="text-right">Unit</th><th className="text-right">Total</th></tr></thead><tbody>{printPreview.budget.items?.map((i,idx)=>(<tr key={idx} className="border-b border-gray-200"><td className="py-2">{i.name}</td><td className="text-center">{i.quantity}</td><td className="text-right">{formatMoney(i.unitPrice, printPreview.budget?.presentationCurrency)}</td><td className="text-right font-bold">{formatMoney(i.unitPrice*i.quantity, printPreview.budget?.presentationCurrency)}</td></tr>))}</tbody></table><div className="text-right font-bold text-xl">Total: {formatMoney(calculateTotals(printPreview.budget.items||[], printPreview.budget.taxRate||0, printPreview.budget.discount||0, printPreview.budget.presentationCurrency||'COP').total, printPreview.budget.presentationCurrency)}</div>{printPreview.budget.notes && <div className="mt-12 pt-8 border-t"><BudgetMarkdownRenderer content={printPreview.budget.notes} isPrintMode={true} /></div>}</div></div>
              </div>
          )}
      </div>
    </div>
  );
};

export default BudgetTool;
