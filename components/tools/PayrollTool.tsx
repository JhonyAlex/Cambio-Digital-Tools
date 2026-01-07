
import React, { useState, useEffect, useMemo } from 'react';
import { payrollService } from '../../services/payrollService';
import { walletService } from '../../services/walletService';
import { revenueService } from '../../services/revenueService';
import { PayrollConfig, Employee, PaymentRecord, PayslipData, WalletAccount, PaymentSource, PaymentBreakdown, ExpenseRecord } from '../../types';
import FinancialConfigModal from './FinancialConfigModal';

const PayrollTool: React.FC = () => {
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [view, setView] = useState<'dashboard' | 'employees' | 'payments' | 'history'>('dashboard');
  
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth());
  const [historyEmployeeFilter, setHistoryEmployeeFilter] = useState<string>('all');

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activePaymentEmployee, setActivePaymentEmployee] = useState<Employee | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null); 
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>({ baseSalary: 0, christmasBonus: 0, extraBonus: 0 });
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [currentPayslip, setCurrentPayslip] = useState<PayslipData | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ isOpen: boolean; record: PaymentRecord | null; refundMoney: boolean; }>({ isOpen: false, record: null, refundMoney: false });
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({});

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (feedback) { const timer = setTimeout(() => setFeedback(null), 3000); return () => clearTimeout(timer); } }, [feedback]);
  useEffect(() => {
      if (isPaymentModalOpen) {
          const totalToPay = (paymentBreakdown.baseSalary || 0) + (paymentBreakdown.christmasBonus || 0) + (paymentBreakdown.extraBonus || 0);
          setPaymentSources(prevSources => {
              if (prevSources.length === 1 && prevSources[0].amount !== totalToPay) {
                  return [{ ...prevSources[0], amount: totalToPay }];
              }
              return prevSources;
          });
      }
  }, [paymentBreakdown, isPaymentModalOpen]);

  const loadData = async () => {
    const c = await payrollService.getConfig();
    const e = await payrollService.getEmployees();
    const h = await payrollService.getHistory();
    const w = await walletService.getAccounts();
    setConfig(c); setEmployees(e); setHistory(h); setWallets(w);
  };

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => setFeedback({ message, type });

  const formatMoney = (amount: number) => {
      if (!config) return { cop: '$ 0', eur: '€ 0', val: 0, element: <></> };
      const cop = amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
      const eurVal = amount / config.euroExchangeRate;
      const eur = eurVal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
      return { val: amount, cop, eur, element: (<div className="flex flex-col items-end leading-tight"><span className="font-bold whitespace-nowrap">{cop}</span><span className="text-[10px] text-amber-500 font-mono whitespace-nowrap">{eur}</span></div>) };
  };

  const calculateSalary = (emp: Employee, cfg: PayrollConfig) => {
    const roleDef = cfg.roles.find(r => r.name === emp.role);
    const multiplier = roleDef ? roleDef.multiplier : 1;
    const baseCalc = cfg.baseSalary * multiplier;
    const today = new Date();
    const currentMonth = today.getMonth(); 
    const isPrimaMonth = currentMonth === 5 || currentMonth === 11;
    const christmas = isPrimaMonth ? baseCalc * 0.5 : 0;
    return { base: baseCalc, total: baseCalc + christmas + emp.bonus, christmas };
  };

  const getPaymentStatus = (emp: Employee) => {
      if (!config) return { paid: 0, totalDue: 0, remaining: 0 };
      const financials = calculateSalary(emp, config);
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const paidSoFar = history.filter(record => {
            const rDate = new Date(record.date);
            return rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear && record.employeeId === emp.id;
        }).reduce((acc, record) => acc + record.totalPaid, 0);
      return { paid: paidSoFar, totalDue: financials.total, remaining: Math.max(0, financials.total - paidSoFar), baseSalary: financials.base, bonus: emp.bonus, christmas: financials.christmas };
  };

  const payrollMetrics = useMemo(() => {
    if (!config) return { base: 0, bonus: 0, prima: 0, total: 0 };
    return employees.filter(e => e.active).reduce((acc, emp) => {
            const sal = calculateSalary(emp, config);
            return { base: acc.base + sal.base, bonus: acc.bonus + emp.bonus, prima: acc.prima + sal.christmas, total: acc.total + sal.total };
        }, { base: 0, bonus: 0, prima: 0, total: 0 });
  }, [employees, config]);
  
  const paymentOverview = useMemo(() => {
      if (!config) return { paid: 0, pending: 0, total: 0, progress: 0, fullyPaidCount: 0 };
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const totalToPay = payrollMetrics.total;
      const paidThisMonth = history.filter(r => {
              const d = new Date(r.date);
              return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          }).reduce((acc, r) => acc + r.totalPaid, 0);
      const activeEmployees = employees.filter(e => e.active);
      let fullyPaidCount = 0;
      activeEmployees.forEach(emp => { if (getPaymentStatus(emp).remaining <= 100) fullyPaidCount++; });
      return { paid: paidThisMonth, pending: Math.max(0, totalToPay - paidThisMonth), total: totalToPay, progress: totalToPay > 0 ? (paidThisMonth / totalToPay) * 100 : 0, fullyPaidCount, totalEmployees: activeEmployees.length };
  }, [payrollMetrics, history, employees, config]);

  const getTotalTreasury = () => {
      if (!config) return 0;
      return wallets.reduce((acc, w) => {
          if (w.currency === 'COP') return acc + w.balance;
          return acc + (w.balance * config.euroExchangeRate);
      }, 0);
  };
  
  const filteredHistory = useMemo(() => {
      return history.filter(record => {
          const date = new Date(record.date);
          const matchesDate = date.getMonth() === historyMonth && date.getFullYear() === historyYear;
          const matchesEmployee = historyEmployeeFilter === 'all' || record.employeeId === historyEmployeeFilter;
          return matchesDate && matchesEmployee;
      }).sort((a,b) => b.date - a.date);
  }, [history, historyMonth, historyYear, historyEmployeeFilter]);

  const historyTotals = useMemo(() => {
      return filteredHistory.reduce((acc, curr) => {
          return {
              total: acc.total + curr.totalPaid,
              base: acc.base + (curr.breakdown?.baseSalary || 0),
              prima: acc.prima + (curr.breakdown?.christmasBonus || 0),
              bonus: acc.bonus + (curr.breakdown?.extraBonus || 0)
          };
      }, { total: 0, base: 0, prima: 0, bonus: 0 });
  }, [filteredHistory]);

  const handleOpenPayslip = (emp: Employee) => {
      if (!config) return;
      const financials = calculateSalary(emp, config);
      const stats = getPaymentStatus(emp);
      const now = new Date();
      const monthStr = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
      setCurrentPayslip({ employee: emp, salaryDetails: financials, month: monthStr, pendingBalance: stats.remaining });
      setShowPayslipModal(true);
  };

  const handleOpenHistoryPayslip = (record: PaymentRecord) => {
      const dateObj = new Date(record.date);
      const monthStr = dateObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
      let pending = 0;
      if (config) {
          const emp = employees.find(e => e.id === record.employeeId);
          const baseVal = config.baseSalary * (record.roleMultiplier || 1);
          const isPrima = dateObj.getMonth() === 5 || dateObj.getMonth() === 11;
          const primaVal = isPrima ? baseVal * 0.5 : 0;
          const bonusVal = emp?.bonus || 0;
          const totalMonthDue = baseVal + primaVal + bonusVal;
          const paidInMonth = history.filter(r => {
              const d = new Date(r.date);
              return d.getMonth() === dateObj.getMonth() && d.getFullYear() === dateObj.getFullYear() && r.employeeId === record.employeeId;
          }).reduce((acc, r) => acc + r.totalPaid, 0);
          pending = Math.max(0, totalMonthDue - paidInMonth);
      }
      setCurrentPayslip({
          employee: { id: record.employeeId, fullName: record.employeeName, role: record.role, active: true, bonus: record.breakdown?.extraBonus || record.extraBonus || 0, joinedAt: 0 },
          salaryDetails: { base: record.breakdown?.baseSalary || record.baseSalary, christmas: record.breakdown?.christmasBonus || record.christmasBonus, total: record.totalPaid },
          month: monthStr, pendingBalance: pending
      });
      setShowPayslipModal(true);
  };

  const handleSaveConfig = async (newConfig: PayrollConfig) => { await payrollService.saveConfig(newConfig); setConfig(newConfig); showFeedback("Configuración actualizada."); };
  const handleSaveEmployee = async () => { if (!employeeForm.fullName) return; const newEmp: Employee = { id: editingEmployee?.id || crypto.randomUUID(), fullName: employeeForm.fullName, role: employeeForm.role as any, bonus: Number(employeeForm.bonus) || 0, active: employeeForm.active ?? true, joinedAt: editingEmployee?.joinedAt || Date.now() }; await payrollService.saveEmployee(newEmp); await loadData(); showFeedback("Guardado"); setEditingEmployee(null); setEmployeeForm({}); };
  const handleDeleteEmployee = async (id: string) => { if (confirm("¿Está seguro de eliminar este registro?")) { await payrollService.deleteEmployee(id); await loadData(); showFeedback("Eliminado", 'error'); } };
  const handleToggleActive = async (emp: Employee) => { const updated = { ...emp, active: !emp.active }; await payrollService.saveEmployee(updated); await loadData(); showFeedback(`Estado actualizado: ${updated.active ? 'Activo' : 'Inactivo'}`, updated.active ? 'success' : 'error'); };

  const handleOpenPaymentModal = async (emp: Employee) => { 
      if (!config) return;
      const freshWallets = await walletService.getAccounts();
      setWallets(freshWallets);
      if (freshWallets.length === 0) { alert("⚠️ NO HAY CUENTAS ACTIVAS\n\nDebes crear al menos una cuenta en 'Tesorería'."); return; }
      const financials = calculateSalary(emp, config); setActivePaymentEmployee(emp); setEditingPaymentId(null); setPaymentBreakdown({ baseSalary: financials.base, christmasBonus: financials.christmas, extraBonus: emp.bonus }); 
      const bestWallet = freshWallets.find(w => w.balance > 0); setPaymentSources(bestWallet ? [{ walletId: bestWallet.id, amount: financials.total }] : []); setPaymentDate(new Date().toISOString().split('T')[0]); setPaymentNotes(''); setIsPaymentModalOpen(true); 
  };

  const handleEditPaymentRecord = (record: PaymentRecord) => {
      const emp = employees.find(e => e.id === record.employeeId);
      if (!emp) { alert("El empleado asociado a este pago ya no existe."); return; }
      setActivePaymentEmployee(emp); setEditingPaymentId(record.id); setPaymentBreakdown(record.breakdown || { baseSalary: record.baseSalary, christmasBonus: record.christmasBonus, extraBonus: record.extraBonus });
      if (record.fundSources && record.fundSources.length > 0) setPaymentSources(record.fundSources);
      else if (record.sourceWalletId) setPaymentSources([{ walletId: record.sourceWalletId, amount: record.totalPaid }]);
      else setPaymentSources([]);
      setPaymentDate(new Date(record.date).toISOString().split('T')[0]); setPaymentNotes(record.notes || ''); setIsPaymentModalOpen(true);
  };

  const handleRequestDeleteRecord = (record: PaymentRecord) => { const hasWallet = record.fundSources && record.fundSources.length > 0 && record.fundSources.some(s => !!s.walletId); setConfirmDeleteModal({ isOpen: true, record: record, refundMoney: !!hasWallet }); };
  const handleConfirmDeleteRecord = async () => {
      const { record, refundMoney } = confirmDeleteModal;
      if (!record) return;
      if (refundMoney && config) {
          const sources = record.fundSources || (record.sourceWalletId ? [{ walletId: record.sourceWalletId, amount: record.totalPaid }] : []);
          for (const source of sources) { if (source.amount > 0 && source.walletId) await walletService.processTransaction(source.walletId, source.amount, 'income', config.euroExchangeRate); }
          showFeedback("Dinero devuelto a las cuentas.");
      }
      if (record.linkedExpenseId) try { await revenueService.deleteExpense(record.linkedExpenseId); } catch (e) { console.warn("Could not delete linked expense", e); }
      await payrollService.deletePayment(record.id); loadData(); setConfirmDeleteModal({ isOpen: false, record: null, refundMoney: false });
  };

  const handleAddSource = () => { const unused = wallets.find(w => !paymentSources.find(ps => ps.walletId === w.id)); setPaymentSources([...paymentSources, { walletId: unused?.id || wallets[0]?.id || '', amount: 0 }]); };
  const handleRemoveSource = (i: number) => { const n = [...paymentSources]; n.splice(i, 1); setPaymentSources(n); };
  const handleSourceChange = (i: number, f: keyof PaymentSource, v: any) => { const n = [...paymentSources]; n[i] = { ...n[i], [f]: v }; setPaymentSources(n); };
  
  const handleProcessPayment = async () => {
      if (!activePaymentEmployee || !config) return;
      const totalToPay = paymentBreakdown.baseSalary + paymentBreakdown.christmasBonus + paymentBreakdown.extraBonus;
      if (paymentSources.some(s => !s.walletId)) { alert("⚠️ Por favor selecciona una 'Billetera de Origen' para cada monto."); return; }
      const roleDef = config.roles.find(r => r.name === activePaymentEmployee.role);
      const financials = calculateSalary(activePaymentEmployee, config);
      const [y, m, d] = paymentDate.split('-').map(Number);
      const recordDateTimestamp = new Date(y, m - 1, d, 12).getTime();
      const paymentId = editingPaymentId || crypto.randomUUID();
      const expenseId = crypto.randomUUID();
      const record: PaymentRecord = {
          id: paymentId, date: recordDateTimestamp, employeeId: activePaymentEmployee.id, employeeName: activePaymentEmployee.fullName, role: activePaymentEmployee.role, baseSalary: financials.base, roleMultiplier: roleDef ? roleDef.multiplier : 1, calculatedSalary: financials.total, christmasBonus: paymentBreakdown.christmasBonus, extraBonus: paymentBreakdown.extraBonus, totalPaid: totalToPay, notes: paymentNotes, sourceWalletId: paymentSources[0]?.walletId || '', fundSources: paymentSources, breakdown: paymentBreakdown, linkedExpenseId: !editingPaymentId ? expenseId : undefined 
      };
      try {
          await payrollService.savePayment(record);
          if (!editingPaymentId) {
              try {
                  for (const source of paymentSources) { 
                      if (source.amount > 0) {
                          const walletExists = wallets.find(w => w.id === source.walletId);
                          if (!walletExists) throw new Error(`Billetera no encontrada: ID ${source.walletId}`);
                          await walletService.processTransaction(source.walletId, source.amount, 'expense', config.euroExchangeRate);
                          const expenseRecord: ExpenseRecord = { id: expenseId, title: `Nómina: ${activePaymentEmployee.role}`, amount: source.amount, category: 'other', date: recordDateTimestamp, description: `Pago a ${activePaymentEmployee.fullName}. (Fuente: ${walletExists.name || 'Caja'})`, sourceWalletId: source.walletId };
                          await revenueService.saveExpense(expenseRecord);
                      }
                  }
                  showFeedback("Pago registrado y sincronizado en finanzas");
              } catch (walletError: any) {
                  console.error("Wallet deduction failed", walletError);
                  await payrollService.deletePayment(record.id); 
                  alert(`❌ ERROR DE TRANSACCIÓN BANCARIA:\n\n${walletError.message}\n\nEl registro del pago ha sido revertido.`);
                  return;
              }
          } else showFeedback("Registro actualizado.");
          await loadData(); setIsPaymentModalOpen(false); 
      } catch (e: any) { alert(e.message); }
  };

  if (!config) return <div className="p-10 text-center text-slate-500">Cargando sistema financiero...</div>;
  const totalCostMoney = formatMoney(payrollMetrics.total);
  const totalTreasuryMoney = formatMoney(getTotalTreasury());
  const treasuryUsage = getTotalTreasury() > 0 ? (payrollMetrics.total / getTotalTreasury()) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-[#0f172a]">
      {feedback && <div className="fixed top-24 right-10 z-[100] bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-in fade-in slide-in-from-right-10"><p>{feedback.message}</p></div>}

      {/* HEADER UNIFICADO */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md shrink-0 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="bg-amber-600 p-1.5 rounded-lg text-white">$$</span>
                Panel Ejecutivo
                <button onClick={() => setIsConfigModalOpen(true)} className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800" title="Configuración">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.581-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
            </h1>
            <p className="text-amber-500/80 font-medium text-sm">Control Financiero y Nómina</p>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-xl">
           {['dashboard', 'employees', 'payments', 'history'].map(v => (
               <button key={v} onClick={() => setView(v as any)} className={`px-4 py-2 rounded-lg font-medium text-sm capitalize transition-all ${view === v ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                   {v === 'history' ? 'Informes' : v === 'employees' ? 'Personal' : v === 'payments' ? 'Pagos' : 'Resumen'}
               </button>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
          {view === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-2">Nómina Mensual</p>
                    <h3 className="text-3xl font-bold text-white mb-1">{totalCostMoney.cop}</h3>
                    <p className="text-amber-500 font-mono text-sm">{totalCostMoney.eur}</p>
                    <div className="mt-4 space-y-2 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div className="flex justify-between text-slate-400"><span>Base:</span><span className="text-white">{formatMoney(payrollMetrics.base).cop}</span></div>
                        <div className="flex justify-between text-slate-400"><span>Prima:</span><span className="text-amber-400">{formatMoney(payrollMetrics.prima).cop}</span></div>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-2">Total Tesorería</p>
                    <h3 className="text-3xl font-bold text-white mb-1">{totalTreasuryMoney.cop}</h3>
                    <div className="mt-4"><span className={`text-xs font-bold px-2 py-1 rounded ${treasuryUsage > 90 ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/30 text-emerald-400'}`}>{treasuryUsage.toFixed(1)}% Cobertura</span></div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-2">Personal Activo</p>
                    <h3 className="text-4xl font-bold text-white">{employees.filter(e => e.active).length}</h3>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                        {config.roles.map(r => {
                            const count = employees.filter(e => e.active && e.role === r.name).length;
                            return count > 0 && <div key={r.id} className="flex justify-between bg-slate-950 px-2 py-1 rounded text-slate-400"><span>{r.name}</span><span className="text-white">{count}</span></div>;
                        })}
                    </div>
                </div>
            </div>
          )}

          {view === 'employees' && (
            <div className="space-y-6 animate-in fade-in">
               <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-white">Personal</h2><button onClick={() => { setEditingEmployee(null); setEmployeeForm({ fullName: '', role: config.roles[0]?.name || '', bonus: 0, active: true }); }} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-sm">+ Nuevo</button></div>
               {(editingEmployee !== null || Object.keys(employeeForm).length > 0) && (
                   <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                       <input type="text" placeholder="Nombre" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-amber-500 md:col-span-2" value={employeeForm.fullName || ''} onChange={e => setEmployeeForm({...employeeForm, fullName: e.target.value})} />
                       <select className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-amber-500" value={employeeForm.role || ''} onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})}>{config.roles.map(r => (<option key={r.id} value={r.name}>{r.name} (x{r.multiplier})</option>))}</select>
                       <div className="flex gap-2"><button onClick={handleSaveEmployee} className="flex-1 bg-emerald-600 text-white rounded font-bold">Guardar</button><button onClick={() => { setEditingEmployee(null); setEmployeeForm({}); }} className="flex-1 bg-slate-800 text-slate-400 rounded">Cancel</button></div>
                   </div>
               )}
               <div className="grid grid-cols-1 gap-3">
                   {employees.map(emp => {
                       const f = calculateSalary(emp, config);
                       return (
                           <div key={emp.id} className={`bg-slate-900 border p-4 rounded-xl flex items-center justify-between gap-4 ${!emp.active ? 'border-red-900/30 opacity-60' : 'border-slate-800'}`}>
                               <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-400">{emp.fullName.charAt(0)}</div>
                                   <div><h3 className="text-white font-bold">{emp.fullName}</h3><span className="text-xs uppercase font-bold text-slate-500">{emp.role}</span></div>
                               </div>
                               <div className="hidden md:flex gap-6 text-sm">
                                   <div><span className="text-slate-500 text-xs block">Base</span><span className="text-white font-mono">{formatMoney(f.base).cop}</span></div>
                                   <div><span className="text-slate-500 text-xs block">Total</span><span className="text-amber-400 font-mono font-bold">{formatMoney(f.total).cop}</span></div>
                               </div>
                               <div className="flex gap-2">
                                   <button onClick={() => handleToggleActive(emp)} className={`p-1.5 border rounded-lg ${emp.active ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}`}>O/I</button>
                                   <button onClick={() => { setEditingEmployee(emp); setEmployeeForm(emp); }} className="p-1.5 bg-slate-800 rounded-lg text-blue-400">✎</button>
                                   <button onClick={() => handleDeleteEmployee(emp.id)} className="p-1.5 bg-slate-800 rounded-lg text-red-400">✕</button>
                                   <button onClick={() => handleOpenPayslip(emp)} className="p-1.5 bg-slate-800 rounded-lg text-purple-400">📄</button>
                               </div>
                           </div>
                       );
                   })}
               </div>
            </div>
          )}

          {view === 'payments' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                 {employees.filter(e => e.active).map(emp => {
                     const status = getPaymentStatus(emp);
                     return (
                         <div key={emp.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between hover:border-amber-500/30 transition-colors">
                             <div className="mb-4"><h3 className="text-lg font-bold text-white">{emp.fullName}</h3><p className="text-slate-500 text-xs">{emp.role}</p></div>
                             <div className="space-y-2 mb-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                                 <div className="flex justify-between text-sm text-slate-500"><span>Total</span><span className="text-slate-300">{formatMoney(status.totalDue).cop}</span></div>
                                 <div className="flex justify-between text-lg font-bold text-amber-400 border-t border-slate-800 pt-2 mt-2"><span>Restante</span><span>{formatMoney(status.remaining).cop}</span></div>
                             </div>
                             <button onClick={() => handleOpenPaymentModal(emp)} disabled={status.remaining <= 0} className={`w-full py-3 rounded-xl font-bold shadow-lg ${status.remaining > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{status.remaining > 0 ? 'Procesar Pago' : 'Pagado'}</button>
                         </div>
                     );
                 })}
            </div>
          )}

          {view === 'history' && (
             <div className="space-y-6 animate-in fade-in">
                 <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex gap-4 overflow-x-auto">
                     <select value={historyYear} onChange={e => setHistoryYear(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 text-sm outline-none">{[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select>
                     <select value={historyMonth} onChange={e => setHistoryMonth(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 text-sm outline-none">{['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                     <select value={historyEmployeeFilter} onChange={e => setHistoryEmployeeFilter(e.target.value)} className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 text-sm outline-none"><option value="all">Todos</option>{employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}</select>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="bg-slate-900 p-4 rounded-xl border border-slate-800"><p className="text-xs text-slate-500 font-bold uppercase">Total Mes</p><h3 className="text-2xl font-bold text-emerald-400">{formatMoney(historyTotals.total).cop}</h3></div>
                     <div className="bg-slate-900 p-4 rounded-xl border border-slate-800"><p className="text-xs text-slate-500 font-bold uppercase">Sueldos</p><h3 className="text-xl font-bold text-blue-400">{formatMoney(historyTotals.base).cop}</h3></div>
                     <div className="bg-slate-900 p-4 rounded-xl border border-slate-800"><p className="text-xs text-slate-500 font-bold uppercase">Primas</p><h3 className="text-xl font-bold text-amber-400">{formatMoney(historyTotals.prima).cop}</h3></div>
                     <div className="bg-slate-900 p-4 rounded-xl border border-slate-800"><p className="text-xs text-slate-500 font-bold uppercase">Bonos</p><h3 className="text-xl font-bold text-purple-400">{formatMoney(historyTotals.bonus).cop}</h3></div>
                 </div>
                 <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                     <table className="w-full text-sm text-left text-slate-400">
                         <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500"><tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Empleado</th><th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-center">Acciones</th></tr></thead>
                         <tbody className="divide-y divide-slate-800">
                             {filteredHistory.map((r) => (
                                 <tr key={r.id} className="hover:bg-slate-800/50">
                                     <td className="px-6 py-4">{new Date(r.date).toLocaleDateString()}</td>
                                     <td className="px-6 py-4 font-bold text-white">{r.employeeName}</td>
                                     <td className="px-6 py-4 text-right font-mono text-emerald-400 font-bold">{formatMoney(r.totalPaid).cop}</td>
                                     <td className="px-6 py-4 text-center flex justify-center gap-2">
                                         <button onClick={() => handleOpenHistoryPayslip(r)} className="text-purple-400 p-1.5 hover:bg-slate-800 rounded">📄</button>
                                         <button onClick={() => handleEditPaymentRecord(r)} className="text-blue-400 p-1.5 hover:bg-slate-800 rounded">✎</button>
                                         <button onClick={() => handleRequestDeleteRecord(r)} className="text-red-400 p-1.5 hover:bg-slate-800 rounded">✕</button>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             </div>
          )}
      </div>

      {isPaymentModalOpen && activePaymentEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-6">Procesar Pago: {activePaymentEmployee.fullName}</h3>
                  <div className="space-y-4">
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-3 gap-2">
                          <div><label className="text-[10px] uppercase font-bold text-blue-400">Sueldo</label><input type="number" value={paymentBreakdown.baseSalary} onChange={e=>setPaymentBreakdown({...paymentBreakdown, baseSalary: parseFloat(e.target.value)||0})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"/></div>
                          <div><label className="text-[10px] uppercase font-bold text-amber-400">Prima</label><input type="number" value={paymentBreakdown.christmasBonus} onChange={e=>setPaymentBreakdown({...paymentBreakdown, christmasBonus: parseFloat(e.target.value)||0})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"/></div>
                          <div><label className="text-[10px] uppercase font-bold text-purple-400">Bono</label><input type="number" value={paymentBreakdown.extraBonus} onChange={e=>setPaymentBreakdown({...paymentBreakdown, extraBonus: parseFloat(e.target.value)||0})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"/></div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-400 mb-1 block">Billetera Origen</label>
                          {paymentSources.map((s,i) => (
                              <div key={i} className="flex gap-2 mb-2">
                                  <select value={s.walletId} onChange={e=>handleSourceChange(i,'walletId',e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none">{wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({formatMoney(w.balance).cop})</option>)}</select>
                                  <input type="number" value={s.amount} onChange={e=>handleSourceChange(i,'amount',parseFloat(e.target.value))} className="w-24 bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm text-right"/>
                              </div>
                          ))}
                          <button onClick={handleAddSource} className="text-xs text-blue-400">+ Fuente</button>
                      </div>
                      <div className="flex gap-2">
                          <input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"/>
                          <input type="text" placeholder="Notas..." value={paymentNotes} onChange={e=>setPaymentNotes(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"/>
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                      <button onClick={()=>setIsPaymentModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button>
                      <button onClick={handleProcessPayment} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold">Confirmar Pago</button>
                  </div>
              </div>
          </div>
      )}

      {showPayslipModal && currentPayslip && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white text-slate-900 w-full max-w-md rounded-xl shadow-2xl p-8 animate-in zoom-in-95">
                <div className="text-center mb-6 pb-4 border-b border-gray-200">
                    <h2 className="font-bold text-2xl uppercase tracking-wider">{currentPayslip.month}</h2>
                    <p className="text-sm text-gray-500">Comprobante de Pago - CambioDigital</p>
                </div>
                <div className="space-y-4 mb-8">
                    <div className="flex justify-between font-bold text-lg"><span>{currentPayslip.employee.fullName}</span><span>{currentPayslip.employee.role}</span></div>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between"><span>Base</span><span className="font-mono">{formatMoney(currentPayslip.salaryDetails.base).cop}</span></div>
                        <div className="flex justify-between text-blue-600"><span>Prima</span><span className="font-mono">{formatMoney(currentPayslip.salaryDetails.christmas).cop}</span></div>
                        <div className="flex justify-between text-purple-600"><span>Bono</span><span className="font-mono">{formatMoney(currentPayslip.employee.bonus || 0).cop}</span></div>
                        <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between font-bold text-base text-black"><span>TOTAL</span><span>{formatMoney(currentPayslip.salaryDetails.total).cop}</span></div>
                    </div>
                </div>
                <button onClick={() => setShowPayslipModal(false)} className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold">Cerrar</button>
            </div>
        </div>
      )}

      {config && <FinancialConfigModal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} config={config} onSave={handleSaveConfig} />}
    </div>
  );
};

export default PayrollTool;
