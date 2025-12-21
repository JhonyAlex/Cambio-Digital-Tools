import React from 'react';
import { NavLink } from 'react-router-dom';
import { translations } from '../translations';

interface Props {
  onOpenSettings: () => void;
  isConfigured: boolean;
  t: typeof translations;
}

const Sidebar: React.FC<Props> = ({ onOpenSettings, isConfigured, t }) => {
  const getLinkClasses = (isActive: boolean) => {
    return `w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-xl transition-all ${
      isActive
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`;
  };
  
  // Custom class for Payroll to make it gold/amber
  const getPayrollLinkClasses = (isActive: boolean) => {
    return `w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-xl transition-all ${
      isActive
        ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-amber-500'
    }`;
  };

  // Custom class for Revenue to make it emerald
  const getRevenueLinkClasses = (isActive: boolean) => {
    return `w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-xl transition-all ${
      isActive
        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-emerald-500'
    }`;
  };

  return (
    <div className="w-20 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0 transition-all duration-300">
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-lg shadow-blue-900/20">
          CD
        </div>
        <span className="hidden md:block ml-3 font-bold text-slate-100 tracking-tight">CambioDigital</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-2 space-y-2">
        <NavLink
          to="/app/dashboard"
          className={({ isActive }) => getLinkClasses(isActive)}
          title={t.dashboard}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span className="hidden md:block font-medium">{t.dashboard}</span>
        </NavLink>

        <div className="pt-4 pb-2 px-2 hidden md:block">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.tools}</p>
        </div>

        <NavLink
          to="/app/chronos"
          className={({ isActive }) => getLinkClasses(isActive)}
          title={t.chronosKb}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
          <span className="hidden md:block font-medium">{t.chronosKb}</span>
        </NavLink>

        <NavLink
          to="/app/payroll"
          className={({ isActive }) => getPayrollLinkClasses(isActive)}
          title="Nómina Ejecutiva"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden md:block font-medium">Nómina Ejecutiva</span>
        </NavLink>

        <NavLink
          to="/app/revenue"
          className={({ isActive }) => getRevenueLinkClasses(isActive)}
          title="Control Ingresos"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
          <span className="hidden md:block font-medium">Control Ingresos</span>
        </NavLink>
      </nav>

      {/* Footer Settings */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-xl transition-all relative ${
            isConfigured 
            ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' 
            : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
          }`}
          title={t.configApi}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
             <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
          </svg>
          <span className="hidden md:block font-medium truncate">{t.configApi}</span>
          
          {!isConfigured && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;