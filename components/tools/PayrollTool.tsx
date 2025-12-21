import React, { useState, useEffect } from 'react';
import { payrollService } from '../../services/payrollService';
import { PayrollConfig, Employee, PaymentRecord, PayslipData, RoleDefinition } from '../../types';

const PIN_CODE = "021293";

const PayrollTool: React.FC = () => {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState(false);

  // --- DATA STATE ---
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [view, setView] = useState<'dashboard' | 'employees' | 'history'>('dashboard');
  
  // --- MODAL STATES ---
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [currentPayslip, setCurrentPayslip] = useState<PayslipData | null>(null);

  // --- FORM STATES ---
  const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({});
  const [payslipForm, setPayslipForm] = useState({ message: '', tasks: '', goals: '' });

  // -- CONFIG EDIT STATE --
  const [tempConfig, setTempConfig] = useState<PayrollConfig | null>(null);

  // INITIAL LOAD
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    const c = await payrollService.getConfig();
    const e = await payrollService.getEmployees();
    const h = await payrollService.getHistory();
    setConfig(c);
    setEmployees(e);
    setHistory(h);
  };

  // --- HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === PIN_CODE) {
      setIsAuthenticated(true);
    } else {
      setAuthError(true);
      setPinInput("");
    }
  };

  const handleOpenConfig = () => {
      if(config) setTempConfig(JSON.parse(JSON.stringify(config))); // Deep copy
      setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async (newConfig?: PayrollConfig) => {
    const configToSave = newConfig || tempConfig;
    if (!configToSave) return;
    
    await payrollService.saveConfig(configToSave);
    setConfig(configToSave);
    
    // Only close modal if we were saving from the modal state (no arg passed)
    if (!newConfig) {
        setIsConfigModalOpen(false);
    }
  };

  const handleSaveEmployee = async () => {
    if (!employeeForm.fullName || !employeeForm.role) return;
    
    const newEmp: Employee = {
      id: editingEmployee?.id || crypto.randomUUID(),
      fullName: employeeForm.fullName,
      role: employeeForm.role as any,
      bonus: Number(employeeForm.bonus) || 0,
      active: employeeForm.active ?? true,
      joinedAt: editingEmployee?.joinedAt || Date.now()
    };

    await payrollService.saveEmployee(newEmp);
    await loadData();
    setEditingEmployee(null);
    setEmployeeForm({});
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm("¿Está seguro de eliminar definitivamente este registro? Para ocultarlo de los informes, mejor use la opción 'Desactivar'.")) {
      await payrollService.deleteEmployee(id);
      loadData();
    }
  };

  const handleToggleActive = async (emp: Employee) => {
      const updated = { ...emp, active: !emp.active };
      await payrollService.saveEmployee(updated);
      await loadData();
  };

  const handleOpenPayslip = (emp: Employee) => {
    if (!config) return;
    const salary = calculateSalary(emp, config);
    setCurrentPayslip({
      employee: emp,
      salaryDetails: salary,
      month: new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })
    });
    setPayslipForm({ message: '', tasks: '', goals: '' });
    setShowPayslipModal(true);
  };

  const calculateSalary = (emp: Employee, cfg: PayrollConfig) => {
    const roleDef = cfg.roles.find(r => r.name === emp.role);
    const multiplier = roleDef ? roleDef.multiplier : 1;
    
    const baseCalc = cfg.baseSalary * multiplier;
    const christmas = baseCalc * 0.5;
    return {
      base: baseCalc,
      total: baseCalc + christmas + emp.bonus,
      christmas
    };
  };

  const getTotalPayrollCost = () => {
    if (!config) return 0;
    // Only sum ACTIVE employees
    return employees
        .filter(e => e.active)
        .reduce((acc, emp) => {
            const sal = calculateSalary(emp, config);
            return acc + sal.total;
        }, 0);
  };

  // Roles management within config
  const handleAddRole = () => {
      if(!tempConfig) return;
      const newRole: RoleDefinition = {
          id: crypto.randomUUID(),
          name: "Nuevo Cargo",
          multiplier: 1.0
      };
      setTempConfig({
          ...tempConfig,
          roles: [...tempConfig.roles, newRole]
      });
  };

  const handleRemoveRole = (roleId: string) => {
      if(!tempConfig) return;
      setTempConfig({
          ...tempConfig,
          roles: tempConfig.roles.filter(r => r.id !== roleId)
      });
  };

  const handleUpdateRole = (roleId: string, field: keyof RoleDefinition, value: string | number) => {
      if(!tempConfig) return;
      setTempConfig({
          ...tempConfig,
          roles: tempConfig.roles.map(r => r.id === roleId ? { ...r, [field]: value } : r)
      });
  };

  // --- RENDER: LOGIN ---
  if (!isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-amber-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Acceso Ejecutivo</h2>
          <p className="text-slate-500 mb-6">Sistema de Control de Nómina</p>
          
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 text-center text-2xl tracking-widest text-white rounded-lg py-3 mb-4 focus:ring-2 focus:ring-amber-500 outline-none"
              placeholder="••••••"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
            />
            {authError && <p className="text-red-500 text-sm mb-4">Credenciales inválidas.</p>}
            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold py-3 rounded-lg transition-all"
            >
              ACCEDER
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!config) return <div className="p-10 text-center text-slate-500">Cargando sistema financiero...</div>;

  const totalCostCOP = getTotalPayrollCost();
  const totalCostEUR = totalCostCOP / config.euroExchangeRate;
  const budgetUsage = (totalCostCOP / config.totalBudget) * 100;
  
  // Filter for dashboard counts
  const activeEmployeesCount = employees.filter(e => e.active).length;

  // --- RENDER: MAIN APP ---
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Panel Ejecutivo</h1>
          <p className="text-amber-500/80 font-medium">Control Financiero y Nómina</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setView('dashboard')} 
             className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'dashboard' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
           >
             Dashboard
           </button>
           <button 
             onClick={() => setView('employees')} 
             className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'employees' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
           >
             Personal
           </button>
           <button 
             onClick={() => setView('history')} 
             className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'history' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
           >
             Histórico
           </button>
        </div>
      </div>

      {/* VIEW: DASHBOARD */}
      {view === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          
          {/* KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Total Cost */}
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24 text-amber-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Nómina Mensual Activa</p>
                <h3 className="text-3xl font-bold text-white mb-1">
                   $ {totalCostCOP.toLocaleString('es-CO')}
                </h3>
                <p className="text-amber-500 font-mono text-sm">
                   € {totalCostEUR.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <span>Tasa Cambio:</span>
                    <input 
                      type="number" 
                      value={config.euroExchangeRate}
                      onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if(val > 0) handleSaveConfig({...config, euroExchangeRate: val} as any);
                      }}
                      className="bg-slate-950 border border-slate-700 w-20 px-2 py-0.5 rounded text-white"
                    />
                    <span>COP/EUR</span>
                </div>
             </div>

             {/* Budget Health */}
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Presupuesto Asignado</p>
                <div className="flex items-end justify-between mb-2">
                    <h3 className="text-2xl font-bold text-white">$ {config.totalBudget.toLocaleString('es-CO')}</h3>
                    <span className={`text-sm font-bold ${budgetUsage > 90 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {budgetUsage.toFixed(1)}% Uso
                    </span>
                </div>
                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${budgetUsage > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(budgetUsage, 100)}%` }}
                    ></div>
                </div>
                <button 
                  onClick={handleOpenConfig}
                  className="mt-4 text-xs text-amber-500 hover:text-amber-400 font-medium"
                >
                    Ajustar Presupuesto Global →
                </button>
             </div>

             {/* Employees Count */}
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Total Personal</p>
                    <h3 className="text-4xl font-bold text-white">{activeEmployeesCount}</h3>
                    <p className="text-slate-400 text-sm mt-1">Activos en nómina</p>
                    {employees.length > activeEmployeesCount && (
                        <p className="text-slate-600 text-xs mt-1">
                            (+{employees.length - activeEmployeesCount} inactivos)
                        </p>
                    )}
                </div>
                <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                </div>
             </div>
          </div>

          {/* Config Summary Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
             <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                 <h3 className="font-bold text-white">Configuración Salarial Base & Roles</h3>
                 <button onClick={handleOpenConfig} className="text-amber-500 hover:text-white text-sm">Editar Configuración</button>
             </div>
             <div className="p-6">
                 <div className="mb-4">
                     <p className="text-slate-500 mb-1 text-sm">Salario Mínimo Base</p>
                     <p className="text-white font-bold text-xl">$ {config.baseSalary.toLocaleString('es-CO')}</p>
                 </div>
                 
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                     {config.roles.map(role => (
                         <div key={role.id} className="bg-slate-950 p-3 rounded border border-slate-800">
                             <p className="text-slate-500 text-xs mb-1 truncate" title={role.name}>{role.name}</p>
                             <p className="text-white font-mono text-sm">x{role.multiplier}</p>
                         </div>
                     ))}
                 </div>
             </div>
          </div>
        </div>
      )}

      {/* VIEW: EMPLOYEES */}
      {view === 'employees' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
           <div className="flex justify-between items-center">
               <h2 className="text-xl font-bold text-white">Nómina de Personal</h2>
               <button 
                 onClick={() => { setEditingEmployee(null); setEmployeeForm({ fullName: '', role: config.roles[0]?.name || '', bonus: 0, active: true }); }}
                 className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-amber-900/20"
                 style={{ display: editingEmployee === null && employeeForm.fullName === undefined ? 'block' : 'none' }}
               >
                 + Nuevo Empleado
               </button>
           </div>

           {/* Add/Edit Form Inline (Simple Toggle) */}
           {(editingEmployee !== null || Object.keys(employeeForm).length > 0) && (
               <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-xl mb-6 animate-in fade-in slide-in-from-top-2">
                   <h3 className="text-white font-bold mb-4">{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                       <input 
                         type="text" 
                         placeholder="Nombre Completo" 
                         className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-amber-500 md:col-span-2"
                         value={employeeForm.fullName || ''}
                         onChange={e => setEmployeeForm({...employeeForm, fullName: e.target.value})}
                         autoFocus
                       />
                       <select
                         className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-amber-500"
                         value={employeeForm.role || ''}
                         onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})}
                       >
                           <option value="">Seleccionar Rol...</option>
                           {config.roles.map(r => (
                               <option key={r.id} value={r.name}>{r.name} (x{r.multiplier})</option>
                           ))}
                       </select>
                       <input 
                         type="number" 
                         placeholder="Bonificación Extra ($)" 
                         className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-amber-500"
                         value={employeeForm.bonus || ''}
                         onChange={e => setEmployeeForm({...employeeForm, bonus: parseFloat(e.target.value)})}
                       />
                   </div>
                   <div className="flex gap-3">
                       <button onClick={handleSaveEmployee} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-bold transition-colors">Guardar</button>
                       <button onClick={() => { setEditingEmployee(null); setEmployeeForm({}); }} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition-colors">Cancelar</button>
                   </div>
               </div>
           )}

           <div className="grid grid-cols-1 gap-4">
               {employees.map(emp => {
                   const financials = calculateSalary(emp, config);
                   const isInactive = !emp.active;

                   return (
                       <div key={emp.id} className={`bg-slate-900 border p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${isInactive ? 'border-slate-800 opacity-60 grayscale-[0.5]' : 'border-slate-800 hover:border-slate-700'}`}>
                           <div className="flex items-center gap-4 w-full md:w-auto">
                               <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg relative ${
                                   emp.role.includes('CEO') ? 'bg-amber-500 text-black' : 
                                   emp.role.includes('Senior') ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                               }`}>
                                   {emp.fullName.charAt(0)}
                                   {isInactive && (
                                       <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-slate-900"></span>
                                   )}
                               </div>
                               <div>
                                   <div className="flex items-center gap-2">
                                       <h3 className="text-white font-bold text-lg">{emp.fullName}</h3>
                                       {isInactive && <span className="text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded uppercase font-bold">Inactivo</span>}
                                   </div>
                                   <span className="text-xs uppercase font-bold tracking-wider text-slate-500">{emp.role}</span>
                               </div>
                           </div>
                           
                           <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 w-full md:w-auto text-sm">
                               <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                   <p className="text-slate-500 text-xs">Sueldo Base</p>
                                   <p className="text-slate-300">$ {financials.base.toLocaleString()}</p>
                               </div>
                               <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                   <p className="text-slate-500 text-xs">Prima Navidad</p>
                                   <p className="text-amber-500/80">$ {financials.christmas.toLocaleString()}</p>
                               </div>
                               <div className="bg-slate-950 p-2 rounded border border-slate-800 col-span-2 md:col-span-1">
                                   <p className="text-slate-500 text-xs">Total Mensual</p>
                                   <p className="text-white font-bold">$ {financials.total.toLocaleString()}</p>
                               </div>
                           </div>

                           <div className="flex gap-2 w-full md:w-auto justify-end">
                               {/* Active Toggle */}
                               <button
                                 onClick={() => handleToggleActive(emp)}
                                 className={`p-2 rounded-lg transition-colors ${emp.active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'}`}
                                 title={emp.active ? "Desactivar" : "Activar"}
                               >
                                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                                   </svg>
                               </button>

                               <button 
                                 onClick={() => handleOpenPayslip(emp)}
                                 disabled={isInactive}
                                 className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors disabled:opacity-50" title="Generar Reporte"
                               >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.198-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                                  </svg>
                               </button>
                               <button 
                                 onClick={() => { setEditingEmployee(emp); setEmployeeForm(emp); }}
                                 className="p-2 text-blue-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
                               >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                  </svg>
                               </button>
                               <button 
                                 onClick={() => handleDeleteEmployee(emp.id)}
                                 className="p-2 text-red-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
                               >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                               </button>
                           </div>
                       </div>
                   );
               })}
           </div>
        </div>
      )}

      {/* VIEW: HISTORY */}
      {view === 'history' && (
         <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center animate-in fade-in">
             <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Archivo Histórico</h3>
             <p className="text-slate-500 max-w-md mx-auto">
                 El sistema guarda automáticamente los pagos al generar los reportes mensuales. 
                 Actualmente esta función está en modo visualización.
             </p>
         </div>
      )}

      {/* MODAL: CONFIGURATION */}
      {isConfigModalOpen && tempConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 flex flex-col max-h-[90vh]">
                  <h3 className="text-xl font-bold text-white mb-6 shrink-0">Configuración Financiera Global</h3>
                  
                  <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold">Presupuesto Total ($)</label>
                            <input 
                                type="number" 
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white mt-1"
                                value={tempConfig.totalBudget}
                                onChange={(e) => setTempConfig({...tempConfig, totalBudget: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold">Salario Base ($)</label>
                            <input 
                                type="number" 
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white mt-1"
                                value={tempConfig.baseSalary}
                                onChange={(e) => setTempConfig({...tempConfig, baseSalary: parseFloat(e.target.value)})}
                            />
                        </div>
                      </div>

                      {/* Dynamic Roles Editor */}
                      <div>
                          <div className="flex justify-between items-center mb-2">
                              <label className="text-xs text-slate-400 uppercase font-bold">Cargos y Multiplicadores</label>
                              <button onClick={handleAddRole} className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-2 py-1 rounded">
                                  + Agregar Cargo
                              </button>
                          </div>
                          <div className="space-y-2 bg-slate-950 p-3 rounded border border-slate-800">
                              {tempConfig.roles.map((role) => (
                                  <div key={role.id} className="flex gap-2 items-center">
                                      <input 
                                        type="text" 
                                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white flex-1"
                                        value={role.name}
                                        onChange={(e) => handleUpdateRole(role.id, 'name', e.target.value)}
                                        placeholder="Nombre del cargo"
                                      />
                                      <div className="flex items-center gap-1 w-24">
                                          <span className="text-slate-500 text-xs">x</span>
                                          <input 
                                            type="number" 
                                            step="0.1"
                                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white w-full"
                                            value={role.multiplier}
                                            onChange={(e) => handleUpdateRole(role.id, 'multiplier', parseFloat(e.target.value))}
                                          />
                                      </div>
                                      <button 
                                        onClick={() => handleRemoveRole(role.id)}
                                        className="text-slate-500 hover:text-red-400 p-1"
                                        title="Eliminar Cargo"
                                      >
                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                      </button>
                                  </div>
                              ))}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">* El salario se calcula: Base x Multiplicador.</p>
                      </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3 shrink-0">
                      <button onClick={() => setIsConfigModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button>
                      <button onClick={() => handleSaveConfig()} className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold">Guardar Cambios</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: PAYSLIP GENERATOR */}
      {showPayslipModal && currentPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
              <div className="bg-white text-slate-900 w-full max-w-2xl rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  
                  {/* PRINTABLE AREA */}
                  <div className="p-8 md:p-12 overflow-y-auto" id="printable-payslip">
                      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                          <div>
                              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-900">NOMINA EJECUTIVA</h1>
                              <p className="text-slate-500 text-sm uppercase tracking-widest mt-1">Confidencial</p>
                          </div>
                          <div className="text-right">
                              <p className="font-bold">{currentPayslip.month}</p>
                              <p className="text-sm text-slate-500">ID: {currentPayslip.employee.id.substring(0,6)}</p>
                          </div>
                      </div>

                      <div className="mb-8">
                          <h3 className="text-lg font-bold mb-2">Detalles del Empleado</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                              <div><span className="text-slate-500">Nombre:</span> <span className="font-bold block text-lg">{currentPayslip.employee.fullName}</span></div>
                              <div><span className="text-slate-500">Cargo:</span> <span className="font-bold block text-lg">{currentPayslip.employee.role}</span></div>
                          </div>
                      </div>

                      <table className="w-full mb-8 text-sm">
                          <thead>
                              <tr className="border-b border-slate-300">
                                  <th className="text-left py-2">Concepto</th>
                                  <th className="text-right py-2">Monto</th>
                              </tr>
                          </thead>
                          <tbody>
                              <tr className="border-b border-slate-100">
                                  <td className="py-3">Salario Base (Categoría {currentPayslip.employee.role})</td>
                                  <td className="text-right py-3">$ {currentPayslip.salaryDetails.base.toLocaleString()}</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                  <td className="py-3">Prima de Navidad (50%)</td>
                                  <td className="text-right py-3">$ {currentPayslip.salaryDetails.christmas.toLocaleString()}</td>
                              </tr>
                              {currentPayslip.employee.bonus > 0 && (
                                  <tr className="border-b border-slate-100">
                                      <td className="py-3">Bonificación por Mérito</td>
                                      <td className="text-right py-3">$ {currentPayslip.employee.bonus.toLocaleString()}</td>
                                  </tr>
                              )}
                              <tr className="font-bold text-lg">
                                  <td className="py-4">TOTAL A PAGAR</td>
                                  <td className="text-right py-4">$ {currentPayslip.salaryDetails.total.toLocaleString()}</td>
                              </tr>
                          </tbody>
                      </table>

                      {/* EDITABLE FEEDBACK SECTION */}
                      <div className="bg-slate-50 p-6 border border-slate-200 rounded mb-6 print:bg-transparent print:border-slate-300">
                          <h4 className="font-bold text-amber-600 mb-4 uppercase text-xs tracking-wider">Feedback Ejecutivo</h4>
                          
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-400 mb-1 print:hidden">Mensaje Personal / Feedback</label>
                                  <textarea 
                                    className="w-full bg-transparent border-b border-slate-300 focus:border-amber-500 outline-none resize-none h-20 text-slate-700 print:border-none"
                                    placeholder="Escribe un mensaje motivacional aquí..."
                                    value={payslipForm.message}
                                    onChange={e => setPayslipForm({...payslipForm, message: e.target.value})}
                                  />
                              </div>
                              <div className="grid grid-cols-2 gap-6">
                                  <div>
                                      <label className="block text-xs font-bold text-slate-400 mb-1 print:hidden">Proyectos Pendientes</label>
                                      <textarea 
                                        className="w-full bg-transparent border-b border-slate-300 focus:border-amber-500 outline-none resize-none h-20 text-slate-700 text-sm print:border-none"
                                        placeholder="- Tarea 1..."
                                        value={payslipForm.tasks}
                                        onChange={e => setPayslipForm({...payslipForm, tasks: e.target.value})}
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-400 mb-1 print:hidden">Metas Próximo Mes</label>
                                      <textarea 
                                        className="w-full bg-transparent border-b border-slate-300 focus:border-amber-500 outline-none resize-none h-20 text-slate-700 text-sm print:border-none"
                                        placeholder="- Meta 1..."
                                        value={payslipForm.goals}
                                        onChange={e => setPayslipForm({...payslipForm, goals: e.target.value})}
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="text-center text-xs text-slate-400 mt-12 print:mt-20">
                          <p>Documento generado electrónicamente por CambioDigital Executive Suite.</p>
                      </div>
                  </div>

                  {/* ACTION BAR */}
                  <div className="bg-slate-100 p-4 flex justify-end gap-3 border-t border-slate-200 print:hidden shrink-0">
                      <button 
                        onClick={() => setShowPayslipModal(false)}
                        className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                      >
                          Cerrar
                      </button>
                      <button 
                        onClick={() => window.print()}
                        className="px-6 py-2 bg-slate-900 text-white rounded font-bold hover:bg-slate-800 flex items-center gap-2"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.198-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                          </svg>
                          Imprimir / Guardar PDF
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* CSS FOR PRINTING (Injected here for simplicity) */}
      <style>{`
        @media print {
            body * {
                visibility: hidden;
            }
            #printable-payslip, #printable-payslip * {
                visibility: visible;
            }
            #printable-payslip {
                position: fixed;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: visible;
                background: white;
                color: black;
                padding: 40px;
            }
            /* Hide scrollbars and UI elements */
            ::-webkit-scrollbar { display: none; }
        }
      `}</style>

    </div>
  );
};

export default PayrollTool;