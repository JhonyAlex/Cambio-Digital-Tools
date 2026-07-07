
import React, { useState, useEffect } from 'react';
import { ApiConfig, ApiProvider, CustomProvider, ModelStrategy } from '../types';
import { testApiConnection } from '../services/geminiService';
import { translations } from '../translations';
import { FIREBASE_CONFIG } from '../services/config'; // Import config to check key

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  customProviders: CustomProvider[];
  onSave: (config: ApiConfig) => void;
  onSaveCustomProviders: (providers: CustomProvider[]) => void;
  t: typeof translations;
}

// Predefined Model Options for easy selection
const GEMINI_FAST_MODELS = [
    'gemini-flash-latest', // Stable alias
    'gemini-2.0-flash-exp', // Latest Exp
    'gemini-2.0-flash' // Standard 2.0
];

const GEMINI_COMPLEX_MODELS = [
    'gemini-3-pro-preview',
    'gemini-2.0-pro-exp'
];

const OPENAI_FAST_DEFAULTS = ['gpt-4o-mini', 'gpt-3.5-turbo'];
const OPENAI_COMPLEX_DEFAULTS = ['gpt-4o', 'o1-mini', 'o1-preview'];

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, config, customProviders: externalCustomProviders, onSave, onSaveCustomProviders, t }) => {
  const [localConfig, setLocalConfig] = useState<ApiConfig>(config);
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>(externalCustomProviders);
  const [editingProvider, setEditingProvider] = useState<Partial<CustomProvider> | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'credentials' | 'models' | 'providers'>('credentials');

  // DETERMINE SYSTEM KEY
  // We check Env vars OR Firebase Config
  const envKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : '';
  // @ts-ignore
  const viteKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_KEY : '';
  const firebaseKey = FIREBASE_CONFIG.apiKey;

  const effectiveSystemKey = envKey || viteKey || firebaseKey || '';
  const hasSystemKey = !!(effectiveSystemKey && effectiveSystemKey.length > 10 && !effectiveSystemKey.includes("YOUR_API_KEY"));
  
  // Determine if we are currently using a custom key
  // Logic: If the localConfig.apiKey is NOT empty AND it is NOT the system key, it's custom.
  const isUsingCustomKey = !!localConfig.apiKey && localConfig.apiKey !== effectiveSystemKey;

  // Get the active custom provider (if provider === 'custom')
  const activeCustomProvider = localConfig.provider === 'custom' && localConfig.customProviderId
      ? customProviders.find(p => p.id === localConfig.customProviderId)
      : undefined;

  // Validation: Can we save?
  const isValid = (() => {
      if (localConfig.provider === 'openai') return !!localConfig.apiKey; // OpenAI always needs key
      if (localConfig.provider === 'gemini') {
          // Valid if: User entered a key OR (User left blank AND System Key exists)
          return !!localConfig.apiKey || hasSystemKey;
      }
      if (localConfig.provider === 'custom') {
          // Valid if: There's an active custom provider with apiKey and baseUrl
          return !!activeCustomProvider && !!activeCustomProvider.apiKey && !!activeCustomProvider.baseUrl;
      }
      return false;
  })();

  useEffect(() => {
    if (isOpen) {
      // Ensure models object exists if migrating from old config
      const safeConfig = { ...config };
      if (!safeConfig.models) {
          safeConfig.models = {
              fast: 'gemini-flash-latest',
              complex: 'gemini-3-pro-preview'
          };
      }
      
      // Auto-fix bad models on open
      if (safeConfig.models.fast === 'gemini-2.5-flash-latest') {
          safeConfig.models.fast = 'gemini-flash-latest';
      }
      
      // UX IMPROVEMENT: 
      // If the incoming config key matches the System Key, we clear the input field
      // This ensures the user sees the "Using System API" placeholder instead of the key itself.
      if (safeConfig.provider === 'gemini' && hasSystemKey && safeConfig.apiKey === effectiveSystemKey) {
          safeConfig.apiKey = '';
      }

      setLocalConfig(safeConfig);
      setCustomProviders(externalCustomProviders);
      setEditingProvider(null);
      setTestResult(null);
      setActiveTab('credentials');
    }
  }, [isOpen, config, externalCustomProviders, hasSystemKey, effectiveSystemKey]);

  if (!isOpen) return null;

  const handleProviderChange = (provider: ApiProvider) => {
    const isGemini = provider === 'gemini';
    const isOpenAi = provider === 'openai';
    const isCustom = provider === 'custom';
    
    // If switching to custom and there are providers, auto-select the default or first one
    let customId: string | undefined = undefined;
    if (isCustom && customProviders.length > 0) {
        const defaultP = customProviders.find(p => p.isDefault);
        customId = defaultP ? defaultP.id : customProviders[0].id;
    }

    setLocalConfig(prev => ({
      ...prev,
      provider,
      baseUrl: isOpenAi ? 'https://api.openai.com/v1' : isCustom ? undefined : undefined,
      customProviderId: customId,
      // Set sensible defaults when switching providers
      models: isCustom && customId
          ? customProviders.find(p => p.id === customId)?.models || { fast: '', complex: '' }
          : {
              fast: isGemini ? GEMINI_FAST_MODELS[0] : OPENAI_FAST_DEFAULTS[0],
              complex: isGemini ? GEMINI_COMPLEX_MODELS[0] : OPENAI_COMPLEX_DEFAULTS[0]
          }
    }));
    setTestResult(null);
  };

  // --- CUSTOM PROVIDER MANAGEMENT ---
  const handleAddCustomProvider = () => {
      setEditingProvider({
          id: `custom_${Date.now()}`,
          name: '',
          apiKey: '',
          baseUrl: '',
          models: { fast: '', complex: '' },
          isDefault: customProviders.length === 0
      });
  };

  const handleEditCustomProvider = (provider: CustomProvider) => {
      setEditingProvider({ ...provider });
  };

  const handleSaveCustomProvider = () => {
      if (!editingProvider || !editingProvider.name || !editingProvider.apiKey || !editingProvider.baseUrl) return;
      
      const provider = editingProvider as CustomProvider;
      const exists = customProviders.findIndex(p => p.id === provider.id);
      let updated: CustomProvider[];
      
      if (exists >= 0) {
          updated = [...customProviders];
          updated[exists] = provider;
      } else {
          updated = [...customProviders, provider];
      }
      
      // If this provider is set as default, unset others
      if (provider.isDefault) {
          updated = updated.map(p => ({ ...p, isDefault: p.id === provider.id }));
      }
      
      setCustomProviders(updated);
      setEditingProvider(null);
      
      // If this is the active provider, update the local config too
      if (localConfig.provider === 'custom' && localConfig.customProviderId === provider.id) {
          setLocalConfig(prev => ({ ...prev, models: provider.models }));
      }
  };

  const handleDeleteCustomProvider = (id: string) => {
      if (!confirm('¿Eliminar este proveedor?')) return;
      const updated = customProviders.filter(p => p.id !== id);
      setCustomProviders(updated);
      
      // If deleted was active, switch to first available or back to gemini
      if (localConfig.provider === 'custom' && localConfig.customProviderId === id) {
          if (updated.length > 0) {
              setLocalConfig(prev => ({ ...prev, customProviderId: updated[0].id, models: updated[0].models }));
          } else {
              handleProviderChange('gemini');
          }
      }
      setEditingProvider(null);
  };

  const handleSetDefaultCustomProvider = (id: string) => {
      const updated = customProviders.map(p => ({ ...p, isDefault: p.id === id }));
      setCustomProviders(updated);
  };

  const handleSelectCustomProvider = (id: string) => {
      const provider = customProviders.find(p => p.id === id);
      if (provider) {
          setLocalConfig(prev => ({ ...prev, customProviderId: id, models: provider.models }));
          setTestResult(null);
      }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // For testing, we need to pass the effective key if the user cleared the input (meaning system key)
      const configToTest = { ...localConfig };
      if (configToTest.provider === 'gemini' && !configToTest.apiKey && hasSystemKey) {
          configToTest.apiKey = effectiveSystemKey || '';
      }
      
      // For custom providers, inject the provider's key and baseUrl
      if (configToTest.provider === 'custom' && activeCustomProvider) {
          configToTest.apiKey = activeCustomProvider.apiKey;
          configToTest.baseUrl = activeCustomProvider.baseUrl;
          configToTest.models = activeCustomProvider.models;
      }
      
      if (!configToTest.apiKey) {
          throw new Error("No se ha proporcionado ninguna API Key para probar.");
      }
      
      const successMessage = await testApiConnection(configToTest);
      setTestResult({ success: true, message: successMessage });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleUseSystemKey = () => {
      if (!hasSystemKey) {
          alert("Error: No se detectó ninguna clave de sistema válida.");
          return;
      }
      if(confirm("¿Restaurar al API del Sistema?\n\nEsto borrará tu clave personalizada y usará la clave predeterminada del proyecto.")) {
          setLocalConfig(prev => ({ ...prev, apiKey: '' })); // Clear custom key
          setTestResult(null);
      }
  };

  const updateModel = (type: 'fast' | 'complex', value: string) => {
      setLocalConfig(prev => ({
          ...prev,
          models: { ...prev.models, [type]: value }
      }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700 shrink-0">
          <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-cyan-400">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929 1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.047 7.047 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                {t.apiSettings}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Configuración personal de IA y Modelos</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/50">
            <button 
                onClick={() => setActiveTab('credentials')}
                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'credentials' ? 'border-blue-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
                1. Proveedor & Llave
            </button>
            <button 
                onClick={() => setActiveTab('models')}
                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'models' ? 'border-cyan-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
                2. Estrategia de Modelos
            </button>
            <button 
                onClick={() => setActiveTab('providers')}
                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'providers' ? 'border-violet-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
                3. Proveedores
            </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-[#0b1120]">
          
          {activeTab === 'credentials' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                  {/* Provider Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t.provider}</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => handleProviderChange('gemini')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                          localConfig.provider === 'gemini' 
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                        }`}
                      >
                        Google Gemini
                      </button>
                      <button
                        onClick={() => handleProviderChange('openai')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                          localConfig.provider === 'openai' 
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                        }`}
                      >
                        OpenAI / Compatible
                      </button>
                      <button
                        onClick={() => handleProviderChange('custom')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                          localConfig.provider === 'custom' 
                            ? 'bg-violet-600/20 border-violet-500 text-violet-300' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                        }`}
                      >
                        Personalizado
                      </button>
                    </div>
                  </div>

                  {/* Custom Provider Selector (only when provider === 'custom') */}
                  {localConfig.provider === 'custom' && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                          <label className="block text-xs font-bold text-violet-400 uppercase tracking-wider">
                              Proveedor Activo
                          </label>
                          {customProviders.length === 0 ? (
                              <div className="bg-slate-800/50 border border-dashed border-slate-600 p-4 rounded-xl text-center">
                                  <p className="text-slate-400 text-sm mb-2">No hay proveedores personalizados.</p>
                                  <button 
                                      onClick={() => { setActiveTab('providers'); handleAddCustomProvider(); }}
                                      className="text-xs text-violet-400 hover:text-violet-300 underline"
                                  >
                                      + Añadir un proveedor en la pestaña "Proveedores"
                                  </button>
                              </div>
                          ) : (
                              <div className="space-y-2">
                                  <select 
                                      className="w-full bg-slate-950 border border-violet-500/40 rounded-lg px-3 py-3 text-white text-sm focus:border-violet-500 outline-none"
                                      value={localConfig.customProviderId || ''}
                                      onChange={(e) => handleSelectCustomProvider(e.target.value)}
                                  >
                                      {customProviders.map(p => (
                                          <option key={p.id} value={p.id}>
                                              {p.name} {p.isDefault ? '⭐' : ''} — {p.baseUrl}
                                          </option>
                                      ))}
                                  </select>
                                  {activeCustomProvider && (
                                      <div className="bg-violet-900/20 border border-violet-500/20 p-3 rounded-lg text-xs space-y-1">
                                          <p className="text-violet-300">
                                              <span className="font-bold">API Key:</span> {activeCustomProvider.apiKey.substring(0, 8)}...{activeCustomProvider.apiKey.slice(-4)}
                                          </p>
                                          <p className="text-violet-300">
                                              <span className="font-bold">Base URL:</span> {activeCustomProvider.baseUrl}
                                          </p>
                                          <p className="text-violet-300">
                                              <span className="font-bold">Rápido:</span> {activeCustomProvider.models.fast || '—'} | <span className="font-bold">Potente:</span> {activeCustomProvider.models.complex || '—'}
                                          </p>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                  )}

                  <div className={`space-y-4 bg-slate-800/50 p-4 rounded-xl border ${!isValid && localConfig.provider === 'gemini' ? 'border-red-500/50' : 'border-slate-700/50'} relative`}>
                    {/* SYSTEM KEY BADGE */}
                    {localConfig.provider === 'gemini' && hasSystemKey && !isUsingCustomKey && (
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-emerald-900/40 text-emerald-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Usando API del Sistema
                        </div>
                    )}

                    {/* API Key */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                          <label className={`text-sm font-medium ${!isValid ? 'text-red-400' : 'text-slate-300'}`}>
                              {t.apiKey} {!isValid && '* Requerido'}
                          </label>
                          {localConfig.provider === 'gemini' && hasSystemKey && isUsingCustomKey && (
                              <button 
                                onClick={handleUseSystemKey}
                                className="text-[10px] text-blue-400 hover:text-white underline decoration-blue-500/50 hover:decoration-white transition-all"
                              >
                                  🔄 Usar API del Sistema (Default)
                              </button>
                          )}
                      </div>
                      <input
                        type="password"
                        value={localConfig.apiKey}
                        onChange={(e) => {
                            setLocalConfig({...localConfig, apiKey: e.target.value});
                            setTestResult(null);
                        }}
                        placeholder={
                            localConfig.provider === 'gemini' && hasSystemKey 
                            ? "Usando API del Sistema (Déjalo vacío o ingresa tu llave propia)" 
                            : (localConfig.provider === 'gemini' ? "AIzaSy... (INGRESA TU CLAVE AQUÍ)" : "sk-... (INGRESA TU CLAVE AQUÍ)")
                        }
                        className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-600 transition-colors ${
                            localConfig.provider === 'gemini' && !isUsingCustomKey && hasSystemKey
                            ? 'border-emerald-500/50 focus:border-emerald-500' // Green border if using system
                            : (!isValid ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-blue-500')
                        }`}
                      />
                      {/* FEEDBACK MESSAGES */}
                      {localConfig.provider === 'gemini' && !isUsingCustomKey && hasSystemKey && (
                          <p className="text-[10px] text-emerald-500/80 mt-1">
                              ✓ El sistema está gestionando los costos de IA automáticamente (vía Firebase/Google Cloud).
                          </p>
                      )}
                      
                      {/* CRITICAL WARNING: NO SYSTEM KEY DETECTED */}
                      {localConfig.provider === 'gemini' && !hasSystemKey && !localConfig.apiKey && (
                          <div className="mt-2 bg-red-900/20 border border-red-500/30 p-2 rounded flex items-start gap-2">
                              <span className="text-red-500 text-lg">⚠</span>
                              <p className="text-[11px] text-red-300 leading-tight">
                                  <strong>Sin API Key del Sistema:</strong> No se detectó una variable de entorno ni una configuración de Firebase válida. Debes ingresar manualmente tu API Key.
                              </p>
                          </div>
                      )}
                    </div>

                    {/* Base URL (Only for OpenAI) */}
                    {localConfig.provider === 'openai' && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-slate-300 mb-1">{t.baseUrl}</label>
                        <input
                          type="text"
                          value={localConfig.baseUrl || ''}
                          onChange={(e) => {
                              setLocalConfig({...localConfig, baseUrl: e.target.value});
                              setTestResult(null);
                          }}
                          placeholder="https://api.openai.com/v1"
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-slate-600"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                            Compatible con OpenRouter, Groq, Ollama, etc.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Test Area */}
                  <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <button 
                            type="button"
                            onClick={handleTestConnection}
                            // Allow testing if valid config exists
                            disabled={isTesting || !isValid}
                            className={`text-xs px-3 py-2 rounded-lg border transition-all w-full font-bold ${
                                isTesting || !isValid
                                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                            }`}
                        >
                            {isTesting ? t.testing : t.testConnection}
                        </button>
                      </div>

                      {testResult && (
                          <div className={`p-3 rounded-lg border text-xs font-mono break-all whitespace-pre-wrap animate-in fade-in ${
                              testResult.success 
                                ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' 
                                : 'bg-red-900/30 border-red-500/50 text-red-400'
                          }`}>
                            <span className="font-bold">{testResult.success ? `✓ ${t.success}:` : `✕ ${t.error}:`}</span>
                            {'\n'}{testResult.message}
                          </div>
                      )}
                  </div>
              </div>
          )}

          {activeTab === 'models' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-xl">
                      <p className="text-sm text-blue-200 leading-relaxed">
                          Define qué modelos usar para cada tipo de tarea. Esto te permite optimizar costos y velocidad según la necesidad.
                          {localConfig.provider === 'custom' && activeCustomProvider && (
                              <span className="block mt-1 text-violet-300">
                                  Proveedor activo: <strong>{activeCustomProvider.name}</strong>
                              </span>
                          )}
                      </p>
                  </div>

                  {/* FAST MODEL CONFIG */}
                  <div>
                      <label className="flex justify-between text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                          <span>🚀 Modelo Rápido (Fast)</span>
                          <span className="text-slate-500">Audio, Chat Simple, UI</span>
                      </label>
                      
                      {localConfig.provider === 'gemini' ? (
                          <select 
                              className="w-full bg-slate-950 border border-slate-600 rounded-lg px-3 py-3 text-white text-sm focus:border-emerald-500 outline-none"
                              value={localConfig.models.fast}
                              onChange={(e) => updateModel('fast', e.target.value)}
                          >
                              {GEMINI_FAST_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                      ) : (
                          <div className="relative">
                              <input 
                                type="text"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-3 text-white text-sm focus:border-emerald-500 outline-none"
                                value={localConfig.models.fast}
                                onChange={(e) => updateModel('fast', e.target.value)}
                                placeholder={localConfig.provider === 'custom' ? "Ej: mimo-v2.5-pro" : "Ej: gpt-4o-mini"}
                              />
                              {/* Suggestions for OpenAI/Router */}
                              {localConfig.provider !== 'custom' && (
                                  <div className="flex gap-2 mt-2">
                                      {OPENAI_FAST_DEFAULTS.map(m => (
                                          <button key={m} onClick={() => updateModel('fast', m)} className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 hover:text-white border border-slate-700">
                                              {m}
                                          </button>
                                      ))}
                                  </div>
                              )}
                          </div>
                      )}
                  </div>

                  <div className="border-t border-slate-800 my-4"></div>

                  {/* COMPLEX MODEL CONFIG */}
                  <div>
                      <label className="flex justify-between text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">
                          <span>🧠 Modelo Potente (Complex)</span>
                          <span className="text-slate-500">Razonamiento, Resúmenes, Análisis</span>
                      </label>
                      
                      {localConfig.provider === 'gemini' ? (
                          <select 
                              className="w-full bg-slate-950 border border-slate-600 rounded-lg px-3 py-3 text-white text-sm focus:border-violet-500 outline-none"
                              value={localConfig.models.complex}
                              onChange={(e) => updateModel('complex', e.target.value)}
                          >
                              {GEMINI_COMPLEX_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                      ) : (
                          <div className="relative">
                              <input 
                                type="text"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-3 text-white text-sm focus:border-violet-500 outline-none"
                                value={localConfig.models.complex}
                                onChange={(e) => updateModel('complex', e.target.value)}
                                placeholder={localConfig.provider === 'custom' ? "Ej: mimo-v2.5-pro" : "Ej: gpt-4o"}
                              />
                              {localConfig.provider !== 'custom' && (
                                  <div className="flex gap-2 mt-2">
                                      {OPENAI_COMPLEX_DEFAULTS.map(m => (
                                          <button key={m} onClick={() => updateModel('complex', m)} className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 hover:text-white border border-slate-700">
                                              {m}
                                          </button>
                                      ))}
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          )}

          {activeTab === 'providers' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="bg-violet-900/20 border border-violet-500/20 p-4 rounded-xl">
                      <p className="text-sm text-violet-200 leading-relaxed">
                          Gestiona tus proveedores de IA personalizados. Compatible con cualquier API OpenAI-compatible (MiMo, OpenRouter, Groq, Ollama, etc.).
                      </p>
                  </div>

                  {/* Provider List */}
                  <div className="space-y-3">
                      <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              Proveedores Guardados ({customProviders.length})
                          </label>
                          <button 
                              onClick={handleAddCustomProvider}
                              className="text-xs bg-violet-600/20 text-violet-300 px-3 py-1.5 rounded-lg border border-violet-500/30 hover:bg-violet-600/30 transition-all font-medium"
                          >
                              + Añadir Proveedor
                          </button>
                      </div>

                      {customProviders.length === 0 && !editingProvider && (
                          <div className="bg-slate-800/50 border border-dashed border-slate-600 p-6 rounded-xl text-center">
                              <p className="text-slate-400 text-sm">No hay proveedores personalizados todavía.</p>
                              <p className="text-slate-500 text-xs mt-1">Haz clic en "+ Añadir Proveedor" para empezar.</p>
                          </div>
                      )}

                      {customProviders.map(p => (
                          <div key={p.id} className={`bg-slate-800/80 border rounded-xl p-4 transition-all ${p.isDefault ? 'border-violet-500/50 ring-1 ring-violet-500/20' : 'border-slate-700'}`}>
                              <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                          <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                                          {p.isDefault && (
                                              <span className="text-[10px] bg-violet-600/30 text-violet-300 px-2 py-0.5 rounded-full font-bold">
                                                  ⭐ ACTIVO
                                              </span>
                                          )}
                                      </div>
                                      <p className="text-xs text-slate-400 truncate">{p.baseUrl}</p>
                                      <p className="text-xs text-slate-500 mt-1">
                                          Key: {p.apiKey.substring(0, 6)}...{p.apiKey.slice(-4)} · 
                                          Rápido: {p.models.fast || '—'} · 
                                          Potente: {p.models.complex || '—'}
                                      </p>
                                  </div>
                                  <div className="flex items-center gap-1 ml-3 shrink-0">
                                      {!p.isDefault && (
                                          <button 
                                              onClick={() => handleSetDefaultCustomProvider(p.id)}
                                              title="Establecer como predeterminado"
                                              className="text-xs text-slate-400 hover:text-violet-400 p-1.5 rounded-lg hover:bg-slate-700 transition-all"
                                          >
                                              ⭐
                                          </button>
                                      )}
                                      <button 
                                          onClick={() => handleEditCustomProvider(p)}
                                          title="Editar"
                                          className="text-xs text-slate-400 hover:text-blue-400 p-1.5 rounded-lg hover:bg-slate-700 transition-all"
                                      >
                                          ✏️
                                      </button>
                                      <button 
                                          onClick={() => handleDeleteCustomProvider(p.id)}
                                          title="Eliminar"
                                          className="text-xs text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 transition-all"
                                      >
                                          🗑️
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>

                  {/* Edit / Add Form */}
                  {editingProvider && (
                      <div className="bg-slate-800 border border-violet-500/30 rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                          <h4 className="text-sm font-bold text-violet-300 uppercase tracking-wider">
                              {customProviders.find(p => p.id === editingProvider.id) ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                          </h4>
                          
                          {/* Name */}
                          <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">Nombre del Proveedor</label>
                              <input 
                                  type="text"
                                  value={editingProvider.name || ''}
                                  onChange={(e) => setEditingProvider(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="Ej: MiMo Pro, OpenRouter, Groq..."
                                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none placeholder-slate-600"
                              />
                          </div>

                          {/* Dedicated API Key */}
                          <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">
                                  🔑 API Key Dedicada
                              </label>
                              <input 
                                  type="password"
                                  value={editingProvider.apiKey || ''}
                                  onChange={(e) => setEditingProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                                  placeholder="sk-xxxx o tp-xxxx"
                                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none placeholder-slate-600"
                              />
                              <p className="text-[10px] text-slate-500 mt-1">
                                  Tu clave privada para este proveedor. Nunca se comparte.
                              </p>
                          </div>

                          {/* Dedicated Base URL */}
                          <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">
                                  🌐 URL Base Dedicada
                              </label>
                              <input 
                                  type="text"
                                  value={editingProvider.baseUrl || ''}
                                  onChange={(e) => setEditingProvider(prev => ({ ...prev, baseUrl: e.target.value }))}
                                  placeholder="https://api.xiaomimimo.com/v1"
                                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none placeholder-slate-600"
                              />
                              <p className="text-[10px] text-slate-500 mt-1">
                                  Endpoint base de la API (formato OpenAI-compatible).
                              </p>
                          </div>

                          {/* Model Strategy */}
                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <label className="block text-xs font-medium text-emerald-400 mb-1">🚀 Modelo Rápido</label>
                                  <input 
                                      type="text"
                                      value={editingProvider.models?.fast || ''}
                                      onChange={(e) => setEditingProvider(prev => ({ 
                                          ...prev, 
                                          models: { fast: e.target.value, complex: prev?.models?.complex || '' }
                                      }))}
                                      placeholder="Ej: mimo-v2.5-pro"
                                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none placeholder-slate-600"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium text-violet-400 mb-1">🧠 Modelo Potente</label>
                                  <input 
                                      type="text"
                                      value={editingProvider.models?.complex || ''}
                                      onChange={(e) => setEditingProvider(prev => ({ 
                                          ...prev, 
                                          models: { fast: prev?.models?.fast || '', complex: e.target.value }
                                      }))}
                                      placeholder="Ej: mimo-v2.5-pro"
                                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none placeholder-slate-600"
                                  />
                              </div>
                          </div>

                          {/* Default toggle */}
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                  type="checkbox"
                                  checked={editingProvider.isDefault || false}
                                  onChange={(e) => setEditingProvider(prev => ({ ...prev, isDefault: e.target.checked }))}
                                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-violet-500 focus:ring-violet-500"
                              />
                              <span className="text-sm text-slate-300">Establecer como predeterminado</span>
                          </label>

                          {/* Actions */}
                          <div className="flex justify-end gap-3 pt-2">
                              <button 
                                  onClick={() => setEditingProvider(null)}
                                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                              >
                                  Cancelar
                              </button>
                              <button 
                                  onClick={handleSaveCustomProvider}
                                  disabled={!editingProvider.name || !editingProvider.apiKey || !editingProvider.baseUrl}
                                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                                      editingProvider.name && editingProvider.apiKey && editingProvider.baseUrl
                                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/20'
                                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                  }`}
                              >
                                  Guardar Proveedor
                              </button>
                          </div>
                      </div>
                  )}

                  {/* Preset Quick-Add Buttons */}
                  {!editingProvider && (
                      <div className="space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Añadir Rápido:</p>
                          <div className="flex flex-wrap gap-2">
                              {[
                                  { name: 'Xiaomi MiMo', baseUrl: 'https://api.xiaomimimo.com/v1', fast: 'mimo-v2.5-pro', complex: 'mimo-v2.5-pro' },
                                  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', fast: 'meta-llama/llama-3.1-8b-instruct', complex: 'anthropic/claude-3.5-sonnet' },
                                  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', fast: 'llama-3.1-8b-instant', complex: 'llama-3.1-70b-versatile' },
                                  { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', fast: 'llama3.1', complex: 'llama3.1:70b' },
                              ].map(preset => (
                                  <button 
                                      key={preset.name}
                                      onClick={() => {
                                          setEditingProvider({
                                              id: `custom_${Date.now()}`,
                                              name: preset.name,
                                              apiKey: '',
                                              baseUrl: preset.baseUrl,
                                              models: { fast: preset.fast, complex: preset.complex },
                                              isDefault: customProviders.length === 0
                                          });
                                      }}
                                      className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-violet-500/50 hover:text-violet-300 transition-all"
                                  >
                                      + {preset.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 px-6 py-4 flex justify-between items-center border-t border-slate-700 shrink-0">
          <p className="text-xs text-slate-500">
              {activeTab === 'credentials' 
                  ? (localConfig.provider === 'custom' && activeCustomProvider 
                      ? `Proveedor: ${activeCustomProvider.name}` 
                      : 'Los datos se guardan localmente.')
                  : activeTab === 'providers'
                  ? `${customProviders.length} proveedor(es) guardado(s)`
                  : `Configurado: ${localConfig.provider === 'custom' && activeCustomProvider ? activeCustomProvider.name : localConfig.provider}`
              }
          </p>
          <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                onClick={() => {
                    onSaveCustomProviders(customProviders);
                    onSave(localConfig);
                }}
                disabled={!isValid}
                className={`px-6 py-2 text-white text-sm font-medium rounded-lg shadow-lg transition-all ${
                    isValid 
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' 
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {t.save}
              </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
