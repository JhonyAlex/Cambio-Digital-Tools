
import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { translations } from '../translations';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { AppPermissions } from '../types';
import { TOOLS, GROUPS } from '../toolsRegistry';

interface Props {
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onOpenProfile: () => void;
  isConfigured: boolean;
  t: typeof translations;
}

const Sidebar: React.FC<Props> = ({ onOpenSettings, onOpenAdmin, onOpenProfile, isConfigured, t }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const hasPerm = (_perm?: keyof AppPermissions) => {
      return true;
  };

  const handleLogout = async () => {
      navigate('/app/dashboard');
  };

  // Helper to generate tailwind classes for dynamic colors
  const getActiveClasses = (color: string) => {
      return `bg-${color}-600 text-white shadow-lg shadow-${color}-900/20`;
  };
  
  const getHoverClasses = (color: string) => {
      return `hover:bg-slate-800 hover:text-${color}-500`;
  };

  return (
    <div className="w-20 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0 transition-all duration-300">
      {/* Logo Area */}
      <Link to="/" className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800 hover:bg-slate-800/50 transition-colors group">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-lg shadow-blue-900/20 group-hover:scale-105 transition-transform">
          CD
        </div>
        <span className="hidden md:block ml-3 font-bold text-slate-100 tracking-tight group-hover:text-white">CambioDigital</span>
      </Link>

      {/* User Info Mini (Clickable) */}
      <div 
        onClick={onOpenProfile}
        className="px-4 py-4 hidden md:flex items-center gap-3 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors group"
        title="Editar Perfil"
      >
          <div className="w-8 h-8 rounded-full bg-slate-800 group-hover:bg-blue-600 transition-colors flex items-center justify-center text-xs font-bold text-slate-400 group-hover:text-white">
              {user?.displayName?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate group-hover:text-blue-300 transition-colors">{user?.displayName}</p>
              <p className="text-[10px] text-slate-500 uppercase">{user?.role}</p>
          </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        
        {/* Dashboard - Always visible */}
        <NavLink
          to="/app/dashboard"
          className={({ isActive }) => `mb-6 ${
            isActive
            ? 'w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-xl bg-slate-800 text-white border border-slate-700 shadow-lg'
            : 'w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
          title={t.dashboard}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M3 6a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3V6ZM3 15.75a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2.25Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3v-2.25Z" clipRule="evenodd" />
          </svg>
          <span className="hidden md:block font-medium">{t.dashboard}</span>
        </NavLink>

        {/* Dynamic Groups from Registry */}
        {GROUPS.map(group => {
            // Filter tools that belong to this group AND user has permission for
            const groupTools = TOOLS.filter(tool => tool.group === group.id && hasPerm(tool.perm));
            
            if (groupTools.length === 0) return null;

            return (
                <React.Fragment key={group.id}>
                    <div className="pt-4 pb-2 px-2 hidden md:block">
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{group.label}</p>
                    </div>
                    
                    {groupTools.map(tool => (
                        <NavLink
                            key={tool.id}
                            to={tool.path}
                            className={({ isActive }) => `w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-xl transition-all ${
                                isActive 
                                ? getActiveClasses(tool.color)
                                : `text-slate-400 ${getHoverClasses(tool.color)}`
                            }`}
                            title={tool.shortLabel}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                {tool.iconPath}
                            </svg>
                            <span className="hidden md:block font-medium">{tool.shortLabel}</span>
                        </NavLink>
                    ))}
                </React.Fragment>
            );
        })}

      </nav>

      {/* Footer Settings */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        {user?.role === 'admin' && (
            <button
                onClick={onOpenAdmin}
                className="w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2 rounded-xl text-amber-400 hover:bg-amber-900/20 hover:text-amber-300 transition-all border border-amber-500/20"
                title="Acceso Maestro"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
                <span className="hidden md:block font-medium text-sm">Admin Panel</span>
            </button>
        )}

        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2 rounded-xl transition-all relative ${
            isConfigured 
            ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' 
            : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
          }`}
          title={t.configApi}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
             <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.313-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
          </svg>
          <span className="hidden md:block font-medium truncate text-sm">{t.configApi}</span>
          
          {!isConfigured && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></span>
          )}
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          title="Cerrar Sesión"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          <span className="hidden md:block font-medium text-sm">Salir</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
