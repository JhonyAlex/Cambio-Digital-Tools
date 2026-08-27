
import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../hooks/useAppContext';
import { useAuth } from '../contexts/AuthContext';
import { AppPermissions } from '../types';
import { TOOLS, GROUPS } from '../toolsRegistry';

const Dashboard: React.FC = () => {
  const { t } = useAppContext();
  const { user } = useAuth();

  const hasPerm = (_perm?: keyof AppPermissions) => {
      return true;
  };

  // Check if user has ANY tool access
  const hasAnyTool = TOOLS.some(tool => hasPerm(tool.perm));

  if (!hasAnyTool) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-[#0f172a] p-8 text-center animate-in fade-in">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
                  <span className="text-4xl">🔒</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">Acceso Limitado</h1>
              <p className="text-slate-400 max-w-md text-lg">
                  Tu cuenta está activa, pero no tienes herramientas asignadas.
              </p>
              <div className="mt-8 p-4 bg-slate-900 border border-slate-700 rounded-xl max-w-sm">
                  <p className="text-sm text-slate-300">
                      Contacta al administrador para solicitar acceso a los módulos de <strong>Productividad</strong> o <strong>Finanzas</strong>.
                  </p>
              </div>
          </div>
      );
  }

  // Helpers for Tailwind dynamic class construction (needs full names or safelist, here we construct strings that match standard tailwind patterns)
  const getGradientClass = (gradient: string) => `bg-gradient-to-r ${gradient}`;
  const getHoverBorderClass = (color: string) => `hover:border-${color}-500/50`;
  const getIconBgClass = (color: string) => `bg-${color}-500/10 text-${color}-400 group-hover:bg-${color}-500 group-hover:text-white`;
  const getAvatarClass = (color: string) => `bg-${color}-600 shadow-${color}-900/30`;
  const getLinkClass = (color: string) => `text-${color}-400 group-hover:text-${color}-300`;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#0f172a]">
      <div className="p-8 md:p-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {t.welcome} <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">CambioDigital Tools</span>
          </h1>
          <p className="text-slate-400 text-lg">
            {t.selectTool}
          </p>
        </div>

        <div className="space-y-12 pb-20">
          
          {GROUPS.map(group => {
              // Filter visible tools for this group
              const groupTools = TOOLS.filter(tool => tool.group === group.id && hasPerm(tool.perm));
              
              if (groupTools.length === 0) return null;

              return (
                  <div key={group.id}>
                      <h2 className="text-lg font-bold text-slate-300 mb-6 flex items-center gap-3 border-b border-slate-800 pb-2">
                          <span className={`w-8 h-1 rounded-full ${getGradientClass(group.gradient)}`}></span>
                          {group.label}
                      </h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {groupTools.map(tool => (
                              <Link 
                                key={tool.id}
                                to={tool.path}
                                className={`group relative bg-slate-900 border border-slate-800 rounded-2xl p-6 cursor-pointer hover:bg-slate-800 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-${tool.color}-900/10 ${getHoverBorderClass(tool.color)}`}
                              >
                                <div className={`absolute top-6 right-6 p-2 rounded-lg transition-colors ${getIconBgClass(tool.color)}`}>
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    {tool.iconPath}
                                  </svg>
                                </div>
                                
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg ${getAvatarClass(tool.color)}`}>
                                  {tool.letter}
                                </div>
                                
                                <h3 className="text-xl font-bold text-white mb-2">{tool.label}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                                  {tool.description}
                                </p>
                                
                                <div className={`flex items-center text-sm font-medium ${getLinkClass(tool.color)}`}>
                                  {t.openTool}
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform">
                                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </Link>
                          ))}
                      </div>
                  </div>
              );
          })}

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
