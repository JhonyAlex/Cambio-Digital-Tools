
import React, { useState, useEffect, Suspense } from 'react';
import { createHashRouter, RouterProvider, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import { ApiConfig, CustomProvider } from './types';
import { translations } from './translations';
import { getEffectiveApiKey, validateConnectivity, DB_PROVIDER } from './services/config';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { authService } from './services/authService';

// --- LAZY LOAD TOOLS ---
const ChronosTool = React.lazy(() => import('./components/tools/ChronosTool'));
const PayrollTool = React.lazy(() => import('./components/tools/PayrollTool'));
const RevenueTool = React.lazy(() => import('./components/tools/RevenueTool'));
const WalletTool = React.lazy(() => import('./components/tools/WalletTool'));
const BudgetTool = React.lazy(() => import('./components/tools/BudgetTool'));
const TextPolisherTool = React.lazy(() => import('./components/tools/TextPolisherTool'));
const MeetingAnalystTool = React.lazy(() => import('./components/tools/MeetingAnalystTool'));

// --- LAZY LOAD MODALS (New for Stability) ---
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const UserProfileModal = React.lazy(() => import('./components/UserProfileModal'));

const DEFAULT_CONFIG: ApiConfig = {
  provider: 'gemini',
  apiKey: '', 
  models: {
      fast: 'gemini-flash-latest',
      complex: 'gemini-3-pro-preview'
  }
};

// --- GLOBAL CONNECTION BLOCKER COMPONENT ---
const ConnectionBlocker: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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

// --- FIREBASE PERMISSION ERROR SCREEN ---
const FirestoreRulesErrorScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] bg-[#020617] flex flex-col items-center justify-center p-6 overflow-y-auto">
            <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center text-2xl">🛡️</div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Acceso Bloqueado por Firebase</h2>
                        <p className="text-slate-400">Las reglas de seguridad de Firestore impiden leer los datos.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <p className="text-slate-300 leading-relaxed">
                        Parece que la base de datos se creó en <strong>"Modo Producción"</strong>, el cual bloquea todas las lecturas y escrituras por defecto. Debes actualizar las reglas para permitir que los usuarios autenticados accedan.
                    </p>

                    <div className="bg-black/50 p-4 rounded-xl border border-slate-700">
                        <h4 className="text-white font-bold mb-2 flex justify-between items-center">
                            <span>Pasos para Solucionar:</span>
                            <a 
                                href="https://console.firebase.google.com/u/0/project/cambio-digital-tools/firestore/rules" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 text-sm hover:underline"
                            >
                                Abrir Consola Firebase ↗
                            </a>
                        </h4>
                        <ol className="text-sm text-slate-400 list-decimal list-inside space-y-2 mb-4">
                            <li>Ve a la pestaña <strong>"Reglas" (Rules)</strong> en Cloud Firestore.</li>
                            <li>Borra el código actual y pega el siguiente código permisivo para desarrollo:</li>
                        </ol>
                        
                        <div className="relative group">
                            <pre className="bg-[#0f172a] text-emerald-400 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}
                            </pre>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition-all"
                        >
                            Ya actualicé las reglas, Reintentar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- LOADING SPINNER ---
const PageLoader = () => (
    <div className="h-full flex flex-col items-center justify-center text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm animate-pulse">Cargando módulo...</p>
    </div>
);

// --- LAYOUT COMPONENT ---
const CUSTOM_PROVIDERS_KEY = 'chronos_custom_providers';

const AppLayout: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const { user, loading, authError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Load custom providers
    try {
        const raw = localStorage.getItem(CUSTOM_PROVIDERS_KEY);
        if (raw) setCustomProviders(JSON.parse(raw));
    } catch (e) {}

    const savedConfigStr = localStorage.getItem('chronos_api_config');
    let finalConfig = { ...DEFAULT_CONFIG };
    let userSavedKey = '';
    if (savedConfigStr) {
      try {
        const parsed = JSON.parse(savedConfigStr);
        if (parsed.model && !parsed.models) {
            parsed.models = { fast: 'gemini-flash-latest', complex: parsed.model };
        }
        if (parsed.models?.fast === 'gemini-2.5-flash-latest') {
            parsed.models.fast = 'gemini-flash-latest';
        }
        finalConfig = { ...finalConfig, ...parsed };
        userSavedKey = parsed.apiKey || '';
      } catch (e) {}
    }
    
    // For custom providers, resolve the active provider's API key
    if (finalConfig.provider === 'custom' && finalConfig.customProviderId) {
        try {
            const providers: CustomProvider[] = JSON.parse(localStorage.getItem(CUSTOM_PROVIDERS_KEY) || '[]');
            const active = providers.find(p => p.id === finalConfig.customProviderId);
            if (active) {
                finalConfig.apiKey = active.apiKey;
                finalConfig.baseUrl = active.baseUrl;
                finalConfig.models = active.models;
            }
        } catch (e) {}
    } else {
        finalConfig.apiKey = getEffectiveApiKey(finalConfig.provider, userSavedKey);
    }
    
    setApiConfig(finalConfig);
  }, []);

  const handleSaveCustomProviders = (providers: CustomProvider[]) => {
      setCustomProviders(providers);
      localStorage.setItem(CUSTOM_PROVIDERS_KEY, JSON.stringify(providers));
  };

  const handleSaveSettings = (newConfig: ApiConfig) => {
    // For custom providers, save the config with customProviderId reference (not the injected key)
    const configToSave = { ...newConfig };
    
    if (newConfig.provider === 'custom' && newConfig.customProviderId) {
        // Don't persist the injected key/baseUrl directly — they live in the custom provider record
        configToSave.apiKey = '';
        configToSave.baseUrl = undefined;
        // Update state with the resolved values for immediate use
        const active = customProviders.find(p => p.id === newConfig.customProviderId);
        if (active) {
            newConfig.apiKey = active.apiKey;
            newConfig.baseUrl = active.baseUrl;
            newConfig.models = active.models;
        }
    } else {
        configToSave.apiKey = newConfig.apiKey;
    }
    
    setApiConfig(newConfig);
    localStorage.setItem('chronos_api_config', JSON.stringify(configToSave));
    setIsSettingsOpen(false);
  };

  if (authError === 'permission-denied') return <FirestoreRulesErrorScreen />;
  if (loading) return <div className="h-screen bg-[#0f172a] flex items-center justify-center text-slate-500">Cargando sistema...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role === 'pending') {
      return (
          <div className="h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mb-6 text-2xl">⏳</div>
              <h2 className="text-2xl font-bold text-white mb-2">Cuenta Pendiente de Aprobación</h2>
              <p className="text-slate-400 max-w-md">Tu solicitud ha sido registrada. Un administrador debe autorizar tu acceso.</p>
              <div className="flex flex-col gap-3 mt-8 w-full max-w-xs">
                  <button onClick={() => window.location.reload()} className="w-full px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium transition-all shadow-lg border border-slate-700">Comprobar Estado</button>
                  <button onClick={async () => { await authService.logout(); navigate('/login'); }} className="text-slate-500 hover:text-red-400 text-sm py-2 transition-colors">Cerrar Sesión</button>
              </div>
          </div>
      );
  }

  const isConfigured = (() => {
      if (apiConfig.provider === 'gemini') return !!(apiConfig.apiKey && apiConfig.apiKey.length >= 10);
      if (apiConfig.provider === 'custom') {
          const cp = customProviders.find(p => p.id === apiConfig.customProviderId);
          return !!(cp && cp.apiKey && cp.apiKey.length >= 5 && cp.baseUrl);
      }
      return !!(apiConfig.apiKey && apiConfig.apiKey.length > 0);
  })();
  const t = translations;

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden font-sans">
      <ConnectionBlocker />
      <Sidebar 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        isConfigured={isConfigured}
        t={t}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#0f172a]">
        <Suspense fallback={<PageLoader />}>
            <Outlet context={{ apiConfig, t }} />
        </Suspense>
      </main>

      <Suspense fallback={null}>
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} config={apiConfig} customProviders={customProviders} onSave={handleSaveSettings} onSaveCustomProviders={handleSaveCustomProviders} t={t} />
          {isAdminPanelOpen && <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />}
          <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      </Suspense>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode, requiredPerm: string }> = ({ children, requiredPerm }) => {
    const { user } = useAuth();
    if (!user) return null; 
    if (user.role === 'admin') return <>{children}</>;
    // @ts-ignore
    if (!user.permissions[requiredPerm]) return <div className="h-full flex flex-col items-center justify-center text-center p-10"><div className="text-4xl mb-4">🔒</div><h2 className="text-xl font-bold text-white">Acceso Restringido</h2><p className="text-slate-400">No tienes permisos para acceder a esta herramienta.</p></div>;
    return <>{children}</>;
};

const router = createHashRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <Login /> },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      { path: "", element: <Navigate to="/app/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "chronos", element: <ProtectedRoute requiredPerm="canAccessChronos"><ChronosTool /></ProtectedRoute> },
      { path: "chronos/:projectId", element: <ProtectedRoute requiredPerm="canAccessChronos"><ChronosTool /></ProtectedRoute> },
      { path: "payroll", element: <ProtectedRoute requiredPerm="canAccessPayroll"><PayrollTool /></ProtectedRoute> },
      { path: "revenue", element: <ProtectedRoute requiredPerm="canAccessRevenue"><RevenueTool /></ProtectedRoute> },
      { path: "wallet", element: <ProtectedRoute requiredPerm="canAccessWallet"><WalletTool /></ProtectedRoute> },
      { path: "budgets", element: <ProtectedRoute requiredPerm="canAccessBudgets"><BudgetTool /></ProtectedRoute> },
      { path: "polisher", element: <ProtectedRoute requiredPerm="canAccessPolisher"><TextPolisherTool /></ProtectedRoute> },
      { path: "meetings", element: <ProtectedRoute requiredPerm="canAccessMeetings"><MeetingAnalystTool /></ProtectedRoute> }
    ]
  }
]);

const App: React.FC = () => {
  return (
      <AuthProvider>
          <RouterProvider router={router} />
      </AuthProvider>
  );
};

export default App;
