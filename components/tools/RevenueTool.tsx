import React, { useState, useEffect } from 'react';
import { revenueService } from '../../services/revenueService';
import { payrollService } from '../../services/payrollService';
import { RevenueRecord, Employee, PayrollConfig, RevenueStatus } from '../../types';

const RevenueTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'profitability'>('dashboard');
  
  // Data State
  const [revenues, setRevenues] = useState<RevenueRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
  
  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<RevenueRecord>>({
    status: 'process',
    amount: 0,
    estimatedDate: Date.now()
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Parallel fetching for performance
    const [revs, emps, conf] = await Promise.all([
      revenueService.getRevenues(),
      payrollService.getEmployees(),
      payrollService.getConfig()
    ]);
    setRevenues(revs);
    setEmployees(emps);
    setPayrollConfig(conf);
  };

  const handleSaveRevenue = async () => {
    if (!formData.clientName || !formData.amount || !formData.employeeId) {
      alert("Por favor completa Cliente, Monto y Responsable.");
      return;
    }

    const record: RevenueRecord = {
      id: formData.id || crypto.randomUUID(),
      clientName: formData.clientName,
      amount: Number(formData.amount),
      status: formData.status as RevenueStatus,
      employeeId: formData.employeeId,
      estimatedDate: formData.estimatedDate || Date.now(),
      description: formData.description || '',
      createdAt: formData.createdAt || Date.now()
    };

    await revenueService.saveRevenue(record);
    await loadData();
    setIsFormOpen(false);
    setFormData({ status: 'process', amount: 0, estimatedDate: Date.now() });
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Eliminar este registro de ingreso?")) {
      await revenueService.deleteRevenue(id);
      loadData();
    }
  };

  // --- CALCULATIONS ---
  
  // Payroll Cost Helper
  const getEmployeeMonthlyCost = (emp: Employee) => {
    if (!payrollConfig) return 0;
    // Updated: Look up multiplier in the roles array instead of using deprecated roleMultipliers object
    const roleDef = payrollConfig.roles.find(r => r.name === emp.role);
    const multiplier = roleDef ? roleDef.multiplier : 1;
    
    const baseCalc = payrollConfig.baseSalary * multiplier;
    // const christmasProvision = baseCalc * 0.5 / 12; // Monthly provision (unused variable)
    return baseCalc + emp.bonus; // Simplified monthly cost
  };

  const totalPayrollCost = employees.reduce((acc, emp) => acc + getEmployeeMonthlyCost(emp), 0);
  
  const realIncome = revenues
    .filter(r => r.status === 'paid')
    .reduce((acc, r) => acc + r.amount, 0);
    
  const pendingIncome = revenues
    .filter(r => r.status !== 'paid')
    .reduce((acc, r) => acc + r.amount, 0);

  const breakEven = realIncome - totalPayrollCost;

  const isOverdue = (record: RevenueRecord) => {
    return record.status !== 'paid' && record.estimatedDate < Date.now();
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Control de Ingresos</h1>
          <p className="text-emerald-500/80 font-medium">Gestión de Flujo de Caja y Proyectos</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setActiveTab('dashboard')} 
             className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
           >
             Dashboard
           </button>
           <button 
             onClick={() => setActiveTab('projects')} 
             className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'projects' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
           >
             Proyectos
           </button>
           <button 
             onClick={() => setActiveTab('profitability')} 
             className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'profitability' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
           >
             Rentabilidad
           </button>
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            
            {/* Real Cash */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Caja Real (Cobrado)</p>
              <h3 className="text-3xl font-bold text-white">$ {realIncome.toLocaleString()}</h3>
              <p className="text-emerald-500 text-sm mt-1">
                 Disponible
              </p>
            </div>

            {/* Pending */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Por Cobrar / En Proceso</p>
              <h3 className="text-3xl font-bold text-slate-300">$ {pendingIncome.toLocaleString()}</h3>
              <p className="text-blue-400 text-sm mt-1">
                 Flujo Proyectado
              </p>
            </div>

            {/* Break Even */}
            <div className={`bg-slate-900 border p-6 rounded-2xl ${breakEven >= 0 ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Punto de Equilibrio (Mes)</p>
              <h3 className={`text-3xl font-bold ${breakEven >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {breakEven >= 0 ? '+' : ''}$ {breakEven.toLocaleString()}
              </h3>
              <p className="text-slate-500 text-xs mt-1">Ingresos Reales vs Nómina Total</p>
            </div>

            {/* Exchange Rate */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Tasa de Cambio (Ref)</p>
              <h3 className="text-3xl font-bold text-white">$ {payrollConfig?.euroExchangeRate.toLocaleString()}</h3>
              <p className="text-amber-500 text-sm mt-1">COP / EUR</p>
            </div>
          </div>

          {/* Quick Recent Activity Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
             <div className="p-4 border-b border-slate-800">
               <h3 className="font-bold text-white">Últimos Movimientos</h3>
             </div>
             <table className="w-full text-sm text-left text-slate-400">
               <thead className="text-xs text-slate-500 uppercase bg-slate-800/50">
                 <tr>
                   <th className="px-6 py-3">Cliente</th>
                   <th className="px-6 py-3">Estado</th>
                   <th className="px-6 py-3 text-right">Monto</th>
                 </tr>
               </thead>
               <tbody>
                 {revenues.slice(-5).reverse().map(r => (
                   <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                     <td className="px-6 py-4 font-medium text-white">{r.clientName}</td>
                     <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          r.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                          r.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {r.status === 'paid' ? 'Cobrado' : r.status === 'pending' ? 'Pendiente' : 'En Proceso'}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right text-white">$ {r.amount.toLocaleString()}</td>
                   </tr>
                 ))}
                 {revenues.length === 0 && (
                   <tr><td colSpan={3} className="px-6 py-8 text-center">No hay registros recientes.</td></tr>
                 )}
               </tbody>
             </table>
          </div>
        </div>
      )}

      {/* PROJECTS TAB */}
      {activeTab === 'projects' && (
        <div className="animate-in fade-in slide-in-from-right-4">
          <div className="flex justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Registro de Contratos</h2>
            <button 
              onClick={() => { setIsFormOpen(true); setFormData({ status: 'process', amount: 0, estimatedDate: Date.now() }); }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-emerald-900/20"
            >
              + Registrar Ingreso
            </button>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left text-slate-400">
               <thead className="text-xs text-slate-500 uppercase bg-slate-900 border-b border-slate-700">
                 <tr>
                   <th className="px-4 py-3">Cliente / Proyecto</th>
                   <th className="px-4 py-3">Responsable</th>
                   <th className="px-4 py-3">Fecha Est.</th>
                   <th className="px-4 py-3">Estado</th>
                   <th className="px-4 py-3 text-right">Valor Contrato</th>
                   <th className="px-4 py-3 text-center">Acciones</th>
                 </tr>
               </thead>
               <tbody>
                 {revenues.map(r => {
                   const emp = employees.find(e => e.id === r.employeeId);
                   const overdue = isOverdue(r);
                   return (
                     <tr key={r.id} className="bg-slate-900 border-b border-slate-800 hover:bg-slate-800/50">
                       <td className="px-4 py-4 font-medium text-white">
                         {r.clientName}
                         {r.description && <div className="text-xs text-slate-500 font-normal truncate max-w-[200px]">{r.description}</div>}
                       </td>
                       <td className="px-4 py-4">
                         {emp ? (
                           <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                               {emp.fullName.charAt(0)}
                             </div>
                             <span className="truncate max-w-[120px]">{emp.fullName}</span>
                           </div>
                         ) : <span className="text-red-500 text-xs">Sin asignar</span>}
                       </td>
                       <td className="px-4 py-4">
                         <span className={overdue ? 'text-red-400 font-bold' : ''}>
                           {new Date(r.estimatedDate).toLocaleDateString()}
                         </span>
                         {overdue && <span className="block text-[10px] text-red-500 uppercase font-bold">Vencido</span>}
                       </td>
                       <td className="px-4 py-4">
                          <select 
                            value={r.status}
                            onChange={async (e) => {
                                const updated = { ...r, status: e.target.value as RevenueStatus };
                                await revenueService.saveRevenue(updated);
                                loadData();
                            }}
                            className={`bg-transparent border rounded px-2 py-1 text-xs font-bold outline-none cursor-pointer ${
                                r.status === 'paid' ? 'border-emerald-500 text-emerald-400' :
                                r.status === 'pending' ? 'border-amber-500 text-amber-400' :
                                'border-blue-500 text-blue-400'
                            }`}
                          >
                             <option value="process" className="bg-slate-900 text-blue-400">En Proceso</option>
                             <option value="pending" className="bg-slate-900 text-amber-400">Pendiente</option>
                             <option value="paid" className="bg-slate-900 text-emerald-400">Cobrado</option>
                          </select>
                       </td>
                       <td className="px-4 py-4 text-right text-white font-mono">
                         $ {r.amount.toLocaleString()}
                       </td>
                       <td className="px-4 py-4 text-center">
                          <div className="flex justify-center gap-2">
                             <button onClick={() => { setFormData(r); setIsFormOpen(true); }} className="text-blue-400 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                             </button>
                             <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                             </button>
                          </div>
                       </td>
                     </tr>
                   );
                 })}
                 {revenues.length === 0 && (
                   <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No hay contratos registrados.</td></tr>
                 )}
               </tbody>
             </table>
          </div>
        </div>
      )}

      {/* PROFITABILITY TAB */}
      {activeTab === 'profitability' && (
        <div className="animate-in fade-in slide-in-from-right-4">
           <h2 className="text-xl font-bold text-white mb-6">Análisis de Rentabilidad por Talento</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {employees.map(emp => {
                  const empRevenues = revenues.filter(r => r.employeeId === emp.id);
                  const generated = empRevenues.reduce((acc, r) => acc + r.amount, 0);
                  const paidGenerated = empRevenues.filter(r => r.status === 'paid').reduce((acc, r) => acc + r.amount, 0);
                  const monthlyCost = getEmployeeMonthlyCost(emp);
                  
                  // Simple efficiency: Generated / Cost. (Assuming generated is roughly monthly capacity or total active projects value)
                  // For a better calculation, we'd need monthly breakdown, but this serves as a snapshot.
                  const efficiency = monthlyCost > 0 ? (generated / monthlyCost) : 0;
                  
                  return (
                    <div key={emp.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-lg text-white">
                                    {emp.fullName.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{emp.fullName}</h3>
                                    <span className="text-xs text-slate-500 uppercase">{emp.role}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500">Costo Mensual</p>
                                <p className="text-white font-mono">$ {monthlyCost.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                             <div className="bg-slate-950 p-3 rounded border border-slate-800">
                                 <p className="text-xs text-slate-500">Total Proyectos</p>
                                 <p className="text-white font-bold">{empRevenues.length}</p>
                             </div>
                             <div className="bg-slate-950 p-3 rounded border border-slate-800">
                                 <p className="text-xs text-slate-500">Valor Generado</p>
                                 <p className="text-emerald-400 font-bold">$ {generated.toLocaleString()}</p>
                             </div>
                        </div>

                        <div className="relative pt-2">
                             <div className="flex justify-between text-xs mb-1">
                                 <span className="text-slate-500">Eficiencia Salarial (Generado / Costo)</span>
                                 <span className={efficiency >= 3 ? 'text-emerald-400' : efficiency >= 1 ? 'text-blue-400' : 'text-red-400'}>
                                     {efficiency.toFixed(1)}x
                                 </span>
                             </div>
                             <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                 <div 
                                    className={`h-full ${efficiency >= 3 ? 'bg-emerald-500' : efficiency >= 1 ? 'bg-blue-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(efficiency * 20, 100)}%` }} // Scaling for visual
                                 ></div>
                             </div>
                             <p className="text-[10px] text-slate-600 mt-1">
                                * Se considera saludable una eficiencia > 3x sobre el costo.
                             </p>
                        </div>
                    </div>
                  );
              })}
           </div>
        </div>
      )}

      {/* MODAL FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">
                {formData.id ? 'Editar Contrato' : 'Nuevo Contrato de Ingreso'}
              </h3>
              
              <div className="space-y-4">
                  <div>
                      <label className="text-xs text-slate-400 font-bold">Cliente / Proyecto</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white mt-1"
                        placeholder="Ej: Desarrollo Web ACME"
                        value={formData.clientName || ''}
                        onChange={e => setFormData({...formData, clientName: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="text-xs text-slate-400 font-bold">Monto del Contrato (COP)</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white mt-1"
                        placeholder="0"
                        value={formData.amount || ''}
                        onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs text-slate-400 font-bold">Estado</label>
                          <select 
                             className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white mt-1"
                             value={formData.status}
                             onChange={e => setFormData({...formData, status: e.target.value as RevenueStatus})}
                          >
                              <option value="process">En Proceso</option>
                              <option value="pending">Pendiente</option>
                              <option value="paid">Cobrado</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-xs text-slate-400 font-bold">Fecha Estimada</label>
                          <input 
                             type="date"
                             className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white mt-1"
                             value={formData.estimatedDate ? new Date(formData.estimatedDate).toISOString().split('T')[0] : ''}
                             onChange={e => setFormData({...formData, estimatedDate: new Date(e.target.value).getTime()})}
                          />
                      </div>
                  </div>
                  <div>
                      <label className="text-xs text-slate-400 font-bold">Responsable (Vinculado a Nómina)</label>
                      <select
                         className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white mt-1"
                         value={formData.employeeId || ''}
                         onChange={e => setFormData({...formData, employeeId: e.target.value})}
                      >
                         <option value="">Seleccionar Empleado...</option>
                         {employees.map(e => (
                             <option key={e.id} value={e.id}>{e.fullName} ({e.role})</option>
                         ))}
                      </select>
                  </div>
                  <div>
                      <label className="text-xs text-slate-400 font-bold">Notas / Descripción</label>
                      <textarea 
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white mt-1 h-20 resize-none"
                        value={formData.description || ''}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                      />
                  </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                  <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button>
                  <button onClick={handleSaveRevenue} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold">Guardar</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default RevenueTool;