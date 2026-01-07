
import React, { useState, useEffect } from 'react';
import { walletService } from '../../services/walletService';
import { payrollService } from '../../services/payrollService';
import { revenueService } from '../../services/revenueService';
import { WalletAccount, PayrollConfig, CurrencyType, AccountType, RevenueRecord, ExpenseRecord } from '../../types';

const WalletTool: React.FC = () => {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<WalletAccount>>({ type: 'bank', currency: 'COP', balance: 0 });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; accountId: string | null }>({ isOpen: false, accountId: null });
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (feedback) { const t = setTimeout(() => setFeedback(null), 3000); return () => clearTimeout(t); } }, [feedback]);

  const loadData = async () => {
    const accs = await walletService.getAccounts();
    const cfg = await payrollService.getConfig();
    setAccounts(accs);
    setConfig(cfg);
  };

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => setFeedback({ message, type });

  const handleSave = async () => {
      if(!formData.name) return;
      const isNew = !formData.id;
      const accountId = formData.id || crypto.randomUUID();
      const newBalance = Number(formData.balance) || 0;
      let previousBalance = 0;
      if (!isNew) { const existing = accounts.find(a => a.id === accountId); if (existing) previousBalance = existing.balance; }
      const difference = newBalance - previousBalance;
      const newAccount: WalletAccount = { id: accountId, name: formData.name, type: (formData.type as AccountType) || 'bank', currency: (formData.currency as CurrencyType) || 'COP', balance: newBalance, updatedAt: Date.now() };
      await walletService.saveAccount(newAccount);
      if (Math.abs(difference) > 0) {
          const rate = config?.euroExchangeRate || 4200;
          const amountInCOP = newAccount.currency === 'EUR' ? Math.abs(difference) * rate : Math.abs(difference);
          if (difference > 0) {
              const revenueRec: RevenueRecord = { id: crypto.randomUUID(), clientName: isNew ? `Saldo Inicial: ${newAccount.name}` : `Ajuste Tesorería: ${newAccount.name}`, amount: amountInCOP, status: 'paid', employeeId: '', estimatedDate: Date.now(), description: isNew ? `Creación cuenta ${newAccount.name}` : `Ajuste manual.`, createdAt: Date.now(), targetWalletId: newAccount.id };
              await revenueService.saveRevenue(revenueRec);
          } else {
              const expenseRec: ExpenseRecord = { id: crypto.randomUUID(), title: `Ajuste Negativo: ${newAccount.name}`, amount: amountInCOP, category: 'other', date: Date.now(), description: `Corrección manual.`, sourceWalletId: newAccount.id };
              await revenueService.saveExpense(expenseRec);
          }
      }
      await loadData(); setIsModalOpen(false); setFormData({ type: 'bank', currency: 'COP', balance: 0 });
      showFeedback(`Cuenta ${isNew ? 'creada' : 'actualizada'}: ${newAccount.name}`);
  };

  const handleRequestDelete = (id: string) => {
      const account = accounts.find(a => a.id === id);
      if (account && Math.abs(account.balance) > 0) { alert(`⚠️ La cuenta "${account.name}" tiene saldo. Déjala en 0 antes de eliminar.`); return; }
      setConfirmModal({ isOpen: true, accountId: id });
  };

  const handleConfirmDelete = async () => {
      if (confirmModal.accountId) { await walletService.deleteAccount(confirmModal.accountId); await loadData(); showFeedback("Cuenta eliminada.", 'error'); setConfirmModal({ isOpen: false, accountId: null }); }
  };

  const exchangeRate = config?.euroExchangeRate || 4200;
  const formatMoney = (amount: number, currency: CurrencyType) => amount.toLocaleString(currency === 'COP' ? 'es-CO' : 'es-ES', { style: 'currency', currency: currency, maximumFractionDigits: 0 });
  const getEquivalent = (amount: number, fromCurrency: CurrencyType) => { if (fromCurrency === 'COP') { const eur = amount / exchangeRate; return formatMoney(eur, 'EUR'); } else { const cop = amount * exchangeRate; return formatMoney(cop, 'COP'); } };
  const totalInCOP = accounts.reduce((acc, item) => { if (item.currency === 'COP') return acc + item.balance; return acc + (item.balance * exchangeRate); }, 0);
  const totalInEUR = totalInCOP / exchangeRate;
  const getTypeIcon = (type: AccountType) => { return <span className="text-xl font-bold">{type === 'bank' ? '🏦' : type === 'cash' ? '💵' : '💳'}</span>; };

  return (
    <div className="h-full flex flex-col bg-[#0f172a]">
        {feedback && <div className="fixed top-24 right-10 z-[100] bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-in fade-in"><p>{feedback.message}</p></div>}

        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md shrink-0 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2"><span className="bg-violet-600 p-1.5 rounded-lg text-white">WC</span>Tesorería</h1>
              <p className="text-violet-500/80 font-medium text-sm">Control de Disponibilidad</p>
            </div>
            <button onClick={() => { setFormData({ type: 'bank', currency: 'COP', balance: 0 }); setIsModalOpen(true); }} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-violet-900/20 transition-all">+ Nueva Cuenta</button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Consolidado (COP)</p>
                    <h3 className="text-4xl font-bold text-white mb-1">{formatMoney(totalInCOP, 'COP')}</h3>
                    <p className="text-violet-400 text-sm">Disponible Real</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Equivalente en Euros</p>
                    <h3 className="text-4xl font-bold text-slate-300 mb-1">{formatMoney(totalInEUR, 'EUR')}</h3>
                    <p className="text-amber-500 text-xs mt-2">Tasa Global: $ {exchangeRate.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-center space-y-3">
                    <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Bancos</span><span className="text-white font-bold">{formatMoney(accounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + (a.currency === 'COP' ? a.balance : a.balance * exchangeRate), 0), 'COP')}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Efectivo</span><span className="text-white font-bold">{formatMoney(accounts.filter(a => a.type === 'cash').reduce((sum, a) => sum + (a.currency === 'COP' ? a.balance : a.balance * exchangeRate), 0), 'COP')}</span></div>
                </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">Cuentas Activas <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{accounts.length}</span></h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                {accounts.map(acc => (
                    <div key={acc.id} className="group bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-violet-500/50 transition-all relative flex flex-col h-full">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${acc.type === 'bank' ? 'bg-blue-600' : acc.type === 'cash' ? 'bg-emerald-600' : 'bg-violet-600'} shadow-lg`}>{getTypeIcon(acc.type)}</div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setFormData(acc); setIsModalOpen(true); }} className="text-blue-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors">✎</button>
                                <button onClick={() => handleRequestDelete(acc.id)} className="text-red-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors">✕</button>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1 truncate">{acc.name}</h3>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-4">{acc.type}</p>
                        <div className="mt-auto bg-slate-950 p-3 rounded-lg border border-slate-800">
                            <p className="text-slate-400 text-xs mb-1">Saldo Actual</p>
                            <div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-white">{formatMoney(acc.balance, acc.currency)}</span><span className="text-xs text-slate-500 font-bold">{acc.currency}</span></div>
                            <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center text-xs"><span className="text-slate-500">Equivalente:</span><span className="text-violet-400 font-mono">{getEquivalent(acc.balance, acc.currency)}</span></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-4">{formData.id ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
                    <div className="space-y-4">
                        <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-violet-500" placeholder="Nombre (ej: Bancolombia)" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus />
                        <div className="grid grid-cols-2 gap-4">
                            <select className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}><option value="bank">Banco</option><option value="cash">Efectivo</option><option value="wallet">Digital</option></select>
                            <select className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as any})}><option value="COP">COP</option><option value="EUR">EUR</option></select>
                        </div>
                        <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-violet-500 font-mono text-lg" placeholder="Saldo Inicial" value={formData.balance} onChange={e => setFormData({...formData, balance: parseFloat(e.target.value)})} />
                    </div>
                    <div className="mt-8 flex justify-end gap-3"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button><button onClick={handleSave} className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded font-bold shadow-lg">Guardar</button></div>
                </div>
            </div>
        )}

        {confirmModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-2">¿Eliminar cuenta?</h3>
                    <p className="text-slate-400 text-sm mb-6">Esta acción es irreversible.</p>
                    <div className="grid grid-cols-2 gap-3"><button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-500 text-white py-2 rounded-xl font-bold">SÍ</button><button onClick={() => setConfirmModal({ isOpen: false, accountId: null })} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-xl font-bold border border-slate-700">NO</button></div>
                </div>
            </div>
        )}
    </div>
  );
};

export default WalletTool;
