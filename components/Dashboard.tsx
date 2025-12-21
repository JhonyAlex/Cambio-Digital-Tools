import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../App';

const Dashboard: React.FC = () => {
  const { t } = useAppContext();

  return (
    <div className="p-8 md:p-12 animate-in fade-in duration-500">
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          {t.welcome} <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">CambioDigital Tools</span>
        </h1>
        <p className="text-slate-400 text-lg">
          {t.selectTool}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card: Chronos */}
        <Link 
          to="/app/chronos"
          className="group relative bg-slate-800/50 border border-slate-700 rounded-2xl p-6 cursor-pointer hover:bg-slate-800 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-blue-900/10"
        >
          <div className="absolute top-6 right-6 p-2 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:text-white group-hover:bg-indigo-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg shadow-blue-900/30">
            Ch
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">{t.chronosKb}</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            {t.chronosDesc}
          </p>
          
          <div className="flex items-center text-sm font-medium text-blue-400 group-hover:text-blue-300">
            {t.openTool}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </div>
        </Link>

        {/* Card: Payroll Executive */}
        <Link 
          to="/app/payroll"
          className="group relative bg-slate-800/50 border border-slate-700 rounded-2xl p-6 cursor-pointer hover:bg-slate-800 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-amber-900/10"
        >
          <div className="absolute top-6 right-6 p-2 bg-amber-500/10 rounded-lg text-amber-500 group-hover:text-white group-hover:bg-amber-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <div className="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg shadow-amber-900/30">
            $$
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Nómina Ejecutiva</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Gestión financiera de personal, control presupuestal y reportes ejecutivos automatizados.
          </p>
          
          <div className="flex items-center text-sm font-medium text-amber-500 group-hover:text-amber-400">
            Acceso Seguro
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </div>
        </Link>

        {/* Card: Revenue Control */}
        <Link 
          to="/app/revenue"
          className="group relative bg-slate-800/50 border border-slate-700 rounded-2xl p-6 cursor-pointer hover:bg-slate-800 hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-emerald-900/10"
        >
          <div className="absolute top-6 right-6 p-2 bg-emerald-500/10 rounded-lg text-emerald-500 group-hover:text-white group-hover:bg-emerald-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
               <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg shadow-emerald-900/30">
            IN
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Control de Ingresos</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Gestión de flujo de caja, control de proyectos y análisis de rentabilidad por empleado.
          </p>
          
          <div className="flex items-center text-sm font-medium text-emerald-500 group-hover:text-emerald-400">
            Gestionar Flujo
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </div>
        </Link>

      </div>
    </div>
  );
};

export default Dashboard;