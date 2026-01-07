
import React, { useState, useEffect, useMemo } from 'react';
import { revenueService } from '../../services/revenueService'; 
import { payrollService } from '../../services/payrollService';
import { walletService } from '../../services/walletService';
import { RevenueRecord, ExpenseRecord, Employee, PayrollConfig, RevenueStatus, WalletAccount, ExpenseCategory } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const RevenueTool: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'income' | 'expenses' | 'reports'>('dashboard');
  
  const [revenues, setRevenues] = useState<RevenueRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
  
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportType, setReportType] = useState<'all' | 'income' | 'expense'>('all');

  const [isIncomeFormOpen, setIsIncomeFormOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState<Partial<RevenueRecord>>({});
  const [isIncomeInitialBalance, setIsIncomeInitialBalance] = useState(false);

  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<Partial<ExpenseRecord>>({});
  
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState<number>(4200);

  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ isOpen: boolean; type: 'revenue' | 'expense' | null; record: any | null; revertBalance: boolean; }>({ isOpen: false, type: null, record: null, revertBalance: false });
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmPaymentModal, setConfirmPaymentModal] = useState<{ isOpen: boolean; recordId: string | null; amount: number; type: 'income_collection'; }>({ isOpen: false, recordId: null, amount: 0, type: 'income_collection' });
  const [selectedWalletId, setSelectedWalletId] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (feedback) { const t = setTimeout(() => setFeedback(null), 3000); return () => clearTimeout(t); } }, [feedback]);

  const loadData = async () => {
    const [revs, exps, emps, conf, wals, hist] = await Promise.all([revenueService.getRevenues(), revenueService.getExpenses(), payrollService.getEmployees(), payrollService.getConfig(), walletService.getAccounts(), payrollService.getHistory()]);
    setRevenues(revs); setExpenses(exps); setEmployees(emps); setPayrollConfig(conf); setWallets(wals); setPayrollHistory(hist);
    if(conf) setTempRate(conf.euroExchangeRate);
  };

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => setFeedback({ message, type });
  const getExchangeRate = () => payrollConfig?.euroExchangeRate || 4200;
  const formatDual = (amount: number) => { const rate = getExchangeRate(); const eur = amount / rate; return { cop: amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }), eur: eur.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }) }; };
  const getWalletName = (id?: string) => { if(!id) return null; const w = wallets.find(x => x.id === id); return w ? w.name : 'Desconocido'; };

  const handleUpdateRate = async () => { if(payrollConfig && tempRate > 0) { const newConfig = { ...payrollConfig, euroExchangeRate: tempRate }; await payrollService.saveConfig(newConfig); setPayrollConfig(newConfig); setIsEditingRate(false); showFeedback("Tasa de cambio actualizada."); } };

  const unifiedHistory = useMemo(() => {
      const paidRevenues = revenues.filter(r => r.status === 'paid').map(r => ({ id: r.id, date: r.estimatedDate, title: r.clientName, category: 'Venta/Servicio', amount: r.amount, type: 'income', description: r.description, wallet: getWalletName(r.targetWalletId), createdBy: r.createdBy }));
      const standardExpenses = expenses.map(e => ({ id: e.id, date: e.date, title: e.title, category: e.category, amount: e.amount, type: 'expense', description: e.description, wallet: getWalletName(e.sourceWalletId), createdBy: e.createdBy }));
      return [...paidRevenues, ...standardExpenses].filter(item => { const d = new Date(item.date); const matchesDate = d.getFullYear() === reportYear && d.getMonth() === reportMonth; const matchesType = reportType === 'all' || item.type === reportType; return matchesDate && matchesType; }).sort((a,b) => b.date - a.date);
  }, [revenues, expenses, reportYear, reportMonth, reportType, wallets]);

  const reportStats = useMemo(() => { const income = unifiedHistory.filter(i => i.type === 'income').reduce((acc, i) => acc + i.amount, 0); const expense = unifiedHistory.filter(i => i.type === 'expense').reduce((acc, i) => acc + i.amount, 0); return { income, expense, net: income - expense }; }, [unifiedHistory]);
  const getCategoryLabel = (cat: string) => { switch(cat) { case 'rent': return 'Arriendo/Oficina'; case 'software': return 'Software/SaaS'; case 'marketing': return 'Marketing/Ads'; case 'other': return 'Otros'; default: return cat; } };

  const handleOpenIncomeModal = (record?: RevenueRecord) => {
      if (record) { const wallet = wallets.find(w => w.id === record.targetWalletId); const isEur = wallet?.currency === 'EUR'; const displayAmount = isEur ? (record.amount / getExchangeRate()) : record.amount; setIncomeForm({ ...record, amount: displayAmount }); setIsIncomeInitialBalance(record.clientName.includes("Saldo Inicial")); } 
      else { setIncomeForm({ status: 'process', amount: 0, estimatedDate: Date.now() }); setIsIncomeInitialBalance(false); }
      setIsIncomeFormOpen(true);
  };

  const handleSaveIncome = async () => { 
      if (isIncomeInitialBalance && !incomeForm.targetWalletId) { alert("Selecciona billetera."); return; }
      if (incomeForm.status === 'paid' && !incomeForm.targetWalletId) { alert("⚠️ Para cobrar, selecciona cuenta destino."); return; }
      if (!incomeForm.clientName || !incomeForm.amount) return; 
      const wallet = wallets.find(w => w.id === incomeForm.targetWalletId); const isEur = wallet?.currency === 'EUR'; const rate = getExchangeRate(); const amountInCOP = isEur ? (Number(incomeForm.amount) * rate) : Number(incomeForm.amount);
      const isNew = !incomeForm.id;
      const r: RevenueRecord = { id: incomeForm.id || crypto.randomUUID(), clientName: incomeForm.clientName, amount: amountInCOP, status: incomeForm.status as RevenueStatus, employeeId: incomeForm.employeeId||'', estimatedDate: incomeForm.estimatedDate||Date.now(), description: incomeForm.description||'', createdAt: incomeForm.createdAt || Date.now(), targetWalletId: incomeForm.targetWalletId, createdBy: user?.displayName || 'Sistema' }; 
      await revenueService.saveRevenue(r); 
      if (isNew && r.status === 'paid' && r.targetWalletId) { await walletService.processTransaction(r.targetWalletId, r.amount, 'income', rate); }
      await loadData(); setIsIncomeFormOpen(false); showFeedback(isNew ? "Ingreso registrado." : "Ingreso actualizado."); 
  };

  const handleRequestDeleteIncome = (record: RevenueRecord) => { const isPaid = record.status === 'paid' && !!record.targetWalletId; setConfirmDeleteModal({ isOpen: true, type: 'revenue', record: record, revertBalance: isPaid }); };
  const handleMarkAsPaid = (r: RevenueRecord) => { setConfirmPaymentModal({ isOpen: true, recordId: r.id, amount: r.amount, type: 'income_collection' }); setSelectedWalletId(''); };
  const confirmCollection = async () => { if(!selectedWalletId || !confirmPaymentModal.recordId) return; const r = revenues.find(x=>x.id === confirmPaymentModal.recordId); if(r) { await revenueService.saveRevenue({...r, status: 'paid', targetWalletId: selectedWalletId}); await walletService.processTransaction(selectedWalletId, confirmPaymentModal.amount, 'income', getExchangeRate()); await loadData(); setConfirmPaymentModal({isOpen:false, recordId:null, amount:0, type:'income_collection'}); showFeedback("Cobro registrado y saldo actualizado"); } };

  const handleOpenExpenseModal = (record?: ExpenseRecord) => {
      if (wallets.length === 0) { alert("⚠️ Crea cuentas en Tesorería primero."); return; }
      if (record) { const wallet = wallets.find(w => w.id === record.sourceWalletId); const isEur = wallet?.currency === 'EUR'; const displayAmount = isEur ? (record.amount / getExchangeRate()) : record.amount; setExpenseForm({ ...record, amount: displayAmount }); } 
      else { setExpenseForm({ title: '', amount: 0, category: 'other', date: Date.now(), sourceWalletId: '' }); }
      setIsExpenseFormOpen(true);
  };

  const handleSaveExpense = async () => { 
      if(!expenseForm.title || !expenseForm.amount || !expenseForm.sourceWalletId) return; 
      const wallet = wallets.find(w => w.id === expenseForm.sourceWalletId); const isEur = wallet?.currency === 'EUR'; const rate = getExchangeRate(); const amountInCOP = isEur ? (Number(expenseForm.amount) * rate) : Number(expenseForm.amount);
      const isNew = !expenseForm.id;
      const r: ExpenseRecord = { id: expenseForm.id || crypto.randomUUID(), title: expenseForm.title, amount: amountInCOP, category: expenseForm.category as ExpenseCategory, date: expenseForm.date||Date.now(), description: expenseForm.description||'', sourceWalletId: expenseForm.sourceWalletId, createdBy: user?.displayName || 'Sistema' }; 
      await revenueService.saveExpense(r); 
      if (isNew) { await walletService.processTransaction(r.sourceWalletId!, r.amount, 'expense', rate); }
      await loadData(); setIsExpenseFormOpen(false); showFeedback(isNew ? "Gasto registrado." : "Gasto actualizado."); 
  };

  const handleRequestDeleteExpense = (record: ExpenseRecord) => { const hasWallet = !!record.sourceWalletId; setConfirmDeleteModal({ isOpen: true, type: 'expense', record: record, revertBalance: hasWallet }); };
  const handleConfirmDelete = async () => { const { type, record, revertBalance } = confirmDeleteModal; if (!record) return; const rate = getExchangeRate(); if (type === 'revenue') { if (revertBalance && record.targetWalletId) { await walletService.processTransaction(record.targetWalletId, record.amount, 'expense', rate); showFeedback("Saldo revertido."); } await revenueService.deleteRevenue(record.id); } else if (type === 'expense') { if (revertBalance && record.sourceWalletId) { await walletService.processTransaction(record.sourceWalletId, record.amount, 'income', rate); showFeedback("Dinero devuelto."); } await revenueService.deleteExpense(record.id); } loadData(); setConfirmDeleteModal({ isOpen: false, type: null, record: null, revertBalance: false }); };

  const totalPaidRevenue = revenues.filter(r => r.status === 'paid').reduce((acc, r) => acc + r.amount, 0);
  const totalPendingRevenue = revenues.filter(r => r.status !== 'paid').reduce((acc, r) => acc + r.amount, 0);
  const totalOperatingExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalPayrollPaid = payrollHistory.reduce((acc, p) => acc + p.totalPaid, 0);
  const netCashFlow = totalPaidRevenue - (totalOperatingExpenses + totalPayrollPaid);
  const getSelectedWalletCurrency = (walletId?: string) => { const w = wallets.find(x => x.id === walletId); return w ? w.currency : 'COP'; };

  return (
    <div className="h-full flex flex-col bg-[#0f172a]">
      {feedback && <div className="fixed top-24 right-10 z-[100] bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-in fade-in"><p>{feedback.message}</p></div>}

      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md shrink-0 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="bg-emerald-600 p-1.5 rounded-lg text-white">IN</span>
                Control Financiero
                <button onClick={() => setIsEditingRate(true)} className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800" title="Tasa Cambio">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
            </h1>
            <p className="text-emerald-500/80 font-medium text-sm">Ingresos, Gastos y Flujo de Caja</p>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-xl">
           {['dashboard', 'income', 'expenses', 'reports'].map(t => (
               <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded-lg font-medium text-sm capitalize transition-all ${activeTab === t ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                   {t === 'reports' ? 'Informes' : t === 'income' ? 'Ingresos' : t === 'expenses' ? 'Gastos' : 'Resumen'}
               </button>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
          {activeTab === 'dashboard' && (
              <div className="animate-in fade-in space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <p className="text-slate-500 text-xs font-bold uppercase mb-2">Ingresos Recaudados</p>
                          <h3 className="text-3xl font-bold text-emerald-400">{formatDual(totalPaidRevenue).cop}</h3>
                          <div className="mt-4 pt-2 border-t border-slate-800"><p className="text-slate-500 text-xs">Pendiente por cobrar:</p><p className="text-white text-sm font-bold">{formatDual(totalPendingRevenue).cop}</p></div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <p className="text-slate-500 text-xs font-bold uppercase mb-2">Egresos Totales</p>
                          <h3 className="text-3xl font-bold text-red-400">{formatDual(totalOperatingExpenses + totalPayrollPaid).cop}</h3>
                          <div className="flex flex-col gap-1 text-xs mt-4 pt-2 border-t border-slate-800"><span className="text-red-300 flex justify-between"><span>Operativos:</span> <span>{formatDual(totalOperatingExpenses).cop}</span></span><span className="text-amber-300 flex justify-between"><span>Nómina:</span><span>{formatDual(totalPayrollPaid).cop}</span></span></div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                          <p className="text-slate-500 text-xs font-bold uppercase mb-2">Flujo de Caja Neto</p>
                          <h3 className={`text-3xl font-bold ${netCashFlow >= 0 ? 'text-white' : 'text-red-500'}`}>{formatDual(netCashFlow).cop}</h3>
                          <p className={`font-mono text-sm mt-1 ${netCashFlow >= 0 ? 'text-slate-400' : 'text-red-800'}`}>{formatDual(netCashFlow).eur}</p>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'reports' && (
              <div className="animate-in fade-in space-y-6">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between">
                      <h2 className="text-white font-bold text-lg">Reporte Mensual</h2>
                      <div className="flex gap-3">
                          <select value={reportYear} onChange={e => setReportYear(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 text-sm outline-none">{[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}</select>
                          <select value={reportMonth} onChange={e => setReportMonth(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 text-sm outline-none">{['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
                          <select value={reportType} onChange={e => setReportType(e.target.value as any)} className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 text-sm outline-none"><option value="all">Todo</option><option value="income">Solo Ingresos</option><option value="expense">Solo Gastos</option></select>
                      </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-xl"><p className="text-emerald-400 text-xs font-bold uppercase">Ingresos</p><h3 className="text-2xl font-bold text-white">{formatDual(reportStats.income).cop}</h3></div>
                      <div className="bg-red-900/20 border border-red-500/20 p-4 rounded-xl"><p className="text-red-400 text-xs font-bold uppercase">Gastos</p><h3 className="text-2xl font-bold text-white">{formatDual(reportStats.expense).cop}</h3></div>
                      <div className={`p-4 rounded-xl border ${reportStats.net >= 0 ? 'bg-slate-800 border-slate-700' : 'bg-orange-900/20 border-orange-500/30'}`}><p className="text-slate-400 text-xs font-bold uppercase">Neto</p><h3 className={`text-2xl font-bold ${reportStats.net >= 0 ? 'text-white' : 'text-orange-400'}`}>{formatDual(reportStats.net).cop}</h3></div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-sm text-left text-slate-400">
                          <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500"><tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Concepto</th><th className="px-6 py-4">Usuario</th><th className="px-6 py-4">Origen</th><th className="px-6 py-4 text-right">Monto</th></tr></thead>
                          <tbody className="divide-y divide-slate-800">
                              {unifiedHistory.map((item, idx) => (
                                  <tr key={`${item.id}-${idx}`} className="hover:bg-slate-800/30">
                                      <td className="px-6 py-4">{new Date(item.date).toLocaleDateString()}</td>
                                      <td className="px-6 py-4"><div className="font-bold text-white">{item.title}</div><div className="text-[10px] text-slate-500">{item.type==='expense'?getCategoryLabel(item.category):item.category}</div></td>
                                      <td className="px-6 py-4 text-xs">{item.createdBy || 'Sistema'}</td>
                                      <td className="px-6 py-4">{item.wallet || '-'}</td>
                                      <td className={`px-6 py-4 text-right font-mono font-bold ${item.type==='income'?'text-emerald-400':'text-red-400'}`}>{item.type==='income'?'+':'-'} {formatDual(item.amount).cop}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {activeTab === 'income' && (
              <div className="animate-in fade-in">
                  <div className="flex justify-between mb-6"><h2 className="text-xl font-bold text-white">Ingresos</h2><button onClick={() => handleOpenIncomeModal()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg">+ Nuevo Ingreso</button></div>
                  <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                      <table className="w-full text-sm text-left text-slate-400">
                          <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500"><tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Destino</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Monto</th><th className="px-6 py-4 text-center">Acciones</th></tr></thead>
                          <tbody className="divide-y divide-slate-800">
                              {revenues.map(r => (
                                  <tr key={r.id} className="hover:bg-slate-800/30">
                                      <td className="px-6 py-4 font-bold text-white">{r.clientName}</td>
                                      <td className="px-6 py-4 text-xs text-violet-400">{getWalletName(r.targetWalletId)||'-'}</td>
                                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold border ${r.status==='paid'?'bg-emerald-900/30 text-emerald-400 border-emerald-500/20':'bg-blue-900/30 text-blue-400 border-blue-500/20'}`}>{r.status}</span></td>
                                      <td className="px-6 py-4 text-right text-white font-mono font-bold">{formatDual(r.amount).cop}</td>
                                      <td className="px-6 py-4 text-center flex justify-center gap-2">
                                          {r.status!=='paid' && <button onClick={()=>handleMarkAsPaid(r)} className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">Cobrar</button>}
                                          <button onClick={()=>handleOpenIncomeModal(r)} className="text-blue-400 p-1.5 hover:bg-slate-800 rounded">✎</button>
                                          <button onClick={()=>handleRequestDeleteIncome(r)} className="text-red-400 p-1.5 hover:bg-slate-800 rounded">✕</button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {activeTab === 'expenses' && (
              <div className="animate-in fade-in">
                  <div className="flex justify-between mb-6"><h2 className="text-xl font-bold text-white">Gastos</h2><button onClick={() => handleOpenExpenseModal()} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg">+ Nuevo Gasto</button></div>
                  <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                      <table className="w-full text-sm text-left text-slate-400">
                          <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500"><tr><th className="px-6 py-4">Concepto</th><th className="px-6 py-4">Categoría</th><th className="px-6 py-4">Origen</th><th className="px-6 py-4 text-right">Monto</th><th className="px-6 py-4 text-center"></th></tr></thead>
                          <tbody className="divide-y divide-slate-800">
                              {expenses.map(e => (
                                  <tr key={e.id} className="hover:bg-slate-800/30">
                                      <td className="px-6 py-4 font-bold text-white">{e.title}</td>
                                      <td className="px-6 py-4 text-xs uppercase font-semibold text-slate-500">{getCategoryLabel(e.category)}</td>
                                      <td className="px-6 py-4 text-xs text-violet-400">{getWalletName(e.sourceWalletId)||'-'}</td>
                                      <td className="px-6 py-4 text-right text-red-400 font-mono font-bold">{formatDual(e.amount).cop}</td>
                                      <td className="px-6 py-4 text-center flex justify-center gap-2">
                                          <button onClick={()=>handleOpenExpenseModal(e)} className="text-blue-400 p-1.5 hover:bg-slate-800 rounded">✎</button>
                                          <button onClick={()=>handleRequestDeleteExpense(e)} className="text-red-400 p-1.5 hover:bg-slate-800 rounded">✕</button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}
      </div>

      {/* MODALS (Simplified for brevity, style matches PayrollTool) */}
      {isIncomeFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl">
                  <h3 className="text-white font-bold text-lg mb-4">{incomeForm.id ? 'Editar Ingreso' : 'Nuevo Ingreso'}</h3>
                  <div className="space-y-4">
                      {!isIncomeInitialBalance && <input type="text" placeholder="Cliente" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none focus:border-emerald-500" value={incomeForm.clientName||''} onChange={e=>setIncomeForm({...incomeForm,clientName:e.target.value})}/>}
                      <select className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" value={incomeForm.targetWalletId || ''} onChange={e=>setIncomeForm({...incomeForm,targetWalletId:e.target.value})}><option value="">Seleccionar Cuenta...</option>{wallets.map(w=>(<option key={w.id} value={w.id}>{w.name}</option>))}</select>
                      <input type="number" placeholder="Monto" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none focus:border-emerald-500" value={incomeForm.amount||''} onChange={e=>setIncomeForm({...incomeForm,amount:parseFloat(e.target.value)})}/>
                      {!isIncomeInitialBalance && <select className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" value={incomeForm.status} onChange={e=>setIncomeForm({...incomeForm,status:e.target.value as any})}><option value="process">En Proceso</option><option value="pending">Pendiente</option><option value="paid">Cobrado</option></select>}
                  </div>
                  <div className="mt-6 flex justify-end gap-2"><button onClick={()=>setIsIncomeFormOpen(false)} className="text-slate-400 px-4 hover:text-white">Cancelar</button><button onClick={handleSaveIncome} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded font-bold">Guardar</button></div>
              </div>
          </div>
      )}

      {isExpenseFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl">
                  <h3 className="text-white font-bold text-lg mb-4">Registro Gasto</h3>
                  <div className="space-y-4">
                      <input type="text" placeholder="Concepto" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-red-500 outline-none" value={expenseForm.title||''} onChange={e=>setExpenseForm({...expenseForm,title:e.target.value})}/>
                      <select className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" value={expenseForm.sourceWalletId || ''} onChange={e=>setExpenseForm({...expenseForm,sourceWalletId:e.target.value})}><option value="">Origen...</option>{wallets.map(w=>(<option key={w.id} value={w.id}>{w.name}</option>))}</select>
                      <input type="number" placeholder="Monto" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none focus:border-red-500" value={expenseForm.amount||''} onChange={e=>setExpenseForm({...expenseForm,amount:parseFloat(e.target.value)})}/>
                      <select className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value as any})}><option value="rent">Arriendo</option><option value="software">Software</option><option value="marketing">Marketing</option><option value="other">Otros</option></select>
                  </div>
                  <div className="mt-6 flex justify-end gap-2"><button onClick={()=>setIsExpenseFormOpen(false)} className="text-slate-400 px-4 hover:text-white">Cancelar</button><button onClick={handleSaveExpense} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded font-bold">Guardar</button></div>
              </div>
          </div>
      )}
      
      {confirmPaymentModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl">
                  <h3 className="text-white font-bold text-lg mb-4">Confirmar Recaudo</h3>
                  <select value={selectedWalletId} onChange={e=>setSelectedWalletId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white mb-4"><option value="">Destino...</option>{wallets.map(w=>(<option key={w.id} value={w.id}>{w.name}</option>))}</select>
                  <div className="flex gap-2"><button onClick={()=>setConfirmPaymentModal({...confirmPaymentModal,isOpen:false})} className="flex-1 py-2 text-slate-400 hover:bg-slate-800 rounded">Cancelar</button><button onClick={confirmCollection} disabled={!selectedWalletId} className="flex-1 py-2 bg-emerald-600 text-white rounded font-bold disabled:opacity-50">Confirmar</button></div>
              </div>
          </div>
      )}

      {confirmDeleteModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl">
                  <h3 className="text-white font-bold text-lg mb-2">Confirmar Eliminación</h3>
                  <p className="text-slate-400 text-sm mb-4">¿Eliminar este registro?</p>
                  {(confirmDeleteModal.type === 'revenue' && confirmDeleteModal.record?.status === 'paid') || (confirmDeleteModal.type === 'expense' && confirmDeleteModal.record?.sourceWalletId) ? (
                      <div className="bg-slate-800 p-3 rounded-lg mb-6 flex items-start gap-3"><input type="checkbox" checked={confirmDeleteModal.revertBalance} onChange={e => setConfirmDeleteModal({ ...confirmDeleteModal, revertBalance: e.target.checked })} className="mt-1 w-4 h-4 rounded"/><label className="text-sm text-slate-300">Revertir saldo en cuenta</label></div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3"><button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold">Eliminar</button><button onClick={() => setConfirmDeleteModal({ isOpen: false, type: null, record: null, revertBalance: false })} className="bg-slate-800 text-white py-2 rounded">Cancelar</button></div>
              </div>
          </div>
      )}

      {isEditingRate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                  <h3 className="text-white font-bold text-lg mb-4">Tasa de Cambio</h3>
                  <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono text-lg mb-4" value={tempRate} onChange={(e) => setTempRate(Number(e.target.value))} />
                  <div className="flex justify-end gap-2"><button onClick={() => setIsEditingRate(false)} className="text-slate-400 px-4 py-2 hover:text-white">Cancelar</button><button onClick={handleUpdateRate} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold">Guardar</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default RevenueTool;
