import React, { useState, useEffect } from 'react';
import { createHashRouter, RouterProvider, Outlet, Navigate, useOutletContext } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import ChronosTool from './components/tools/ChronosTool';
import PayrollTool from './components/tools/PayrollTool';
import RevenueTool from './components/tools/RevenueTool';
import LandingPage from './components/LandingPage';
import { ApiConfig } from './types';
import { translations } from './translations';
import { getEffectiveApiKey, validateConnectivity, DB_PROVIDER } from './services/config';

const DEFAULT_CONFIG: ApiConfig = {
  provider: 'gemini',
  apiKey: '', 
  model: 'gemini-2.5-flash'
};

// --- GLOBAL CONNECTION BLOCKER COMPONENT ---
const ConnectionBlocker: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check (optional deeper check could go here)
    if (DB_PROVIDER === 'firebase') {
        validateConnectivity().catch(() => setIsOnline(false));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-red-950/95 flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-300">
      <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-red-900 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-white">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M12 9v6m0 0v2m0-2h.01M4.5 4.5l15 15" />
        </svg>
      </div>
      <h1 className="text-4xl font-bold text-white mb-4">SISTEMA DESCONECTADO</h1>
      <p className="text-red-200 text-lg max-w-lg mb-8">
        Se ha perdido la conexión con la nube. Por seguridad e integridad de los datos, el sistema se ha bloqueado temporalmente.
      </p>
      <div className="flex flex-col gap-2">
         <p className="text-sm text-red-400 font-mono bg-black/30 p-2 rounded">
             {DB_PROVIDER === 'firebase' ? 'Proveedor: Google Cloud Firestore' : 'Proveedor: Local (Sin Red)'}
         </p>
         <button 
           onClick={() => window.location.reload()}
           className="px-6 py-3 bg-white text-red-900 font-bold rounded-lg hover:bg-gray-100 transition-colors"
         >
           Reintentar Conexión
         </button>
      </div>
    </div>
  );
};

// --- LAYOUT COMPONENT ---
const AppLayout: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_CONFIG);

  // Load settings on mount
  useEffect(() => {
    // 1. API Config Load
    const savedConfigStr = localStorage.getItem('chronos_api_config');
    let finalConfig = { ...DEFAULT_CONFIG };

    let userSavedKey = '';
    if (savedConfigStr) {
      try {
        const parsed = JSON.parse(savedConfigStr);
        finalConfig = { ...finalConfig, ...parsed };
        userSavedKey = parsed.apiKey || '';
      } catch (e) {
        // ignore parse error
      }
    }

    // Apply Modular Logic: User Key -> Env Key
    finalConfig.apiKey = getEffectiveApiKey(userSavedKey);
    
    // Save back if it was purely environmental and we want to persist context
    setApiConfig(finalConfig);
  }, []);

  const handleSaveSettings = (newConfig: ApiConfig) => {
    setApiConfig(newConfig);
    localStorage.setItem('chronos_api_config', JSON.stringify(newConfig));
    setIsSettingsOpen(false);
  };

  const isConfigured = !!(apiConfig.apiKey && apiConfig.apiKey.length >= 10);
  
  // Translation helper
  const t = translations;

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden">
      <ConnectionBlocker />
      <Sidebar 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        isConfigured={isConfigured}
        t={t}
      />
      
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <Outlet context={{ apiConfig, t }} />
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        config={apiConfig}
        onSave={handleSaveSettings}
        t={t}
      />
    </div>
  );
};

// --- TYPE FOR OUTLET CONTEXT ---
export interface AppContextType {
  apiConfig: ApiConfig;
  t: typeof translations;
}

export const useAppContext = () => {
  return useOutletContext<AppContextType>();
};

// --- ROUTER CONFIGURATION ---
const router = createHashRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      {
        path: "",
        element: <Navigate to="/app/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "chronos",
        element: <ChronosTool />,
      },
      {
        path: "chronos/:projectId",
        element: <ChronosTool />,
      },
      {
        path: "payroll",
        element: <PayrollTool />,
      },
      {
        path: "revenue",
        element: <RevenueTool />,
      }
    ]
  }
]);

const App: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default App;