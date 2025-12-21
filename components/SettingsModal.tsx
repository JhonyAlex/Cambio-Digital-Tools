
import React, { useState, useEffect } from 'react';
import { ApiConfig, ApiProvider } from '../types';
import { testApiConnection } from '../services/geminiService';
import { generateMigrationScript, downloadSqlFile } from '../services/postgresGenerator';
import { POSTGRES_CONFIG } from '../services/config';
import { translations } from '../translations';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSave: (config: ApiConfig) => void;
  t: typeof translations;
}

const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro Preview (Complex Reasoning)' },
];

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, config, onSave, t }) => {
  const [localConfig, setLocalConfig] = useState<ApiConfig>(config);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isGeneratingSql, setIsGeneratingSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      setTestResult(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleProviderChange = (provider: ApiProvider) => {
    setLocalConfig(prev => ({
      ...prev,
      provider,
      model: provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o',
      baseUrl: provider === 'openai' ? 'https://api.openai.com/v1' : undefined
    }));
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const successMessage = await testApiConnection(localConfig);
      setTestResult({ success: true, message: successMessage });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDownloadSql = async () => {
      setIsGeneratingSql(true);
      try {
          const sql = await generateMigrationScript();
          downloadSqlFile(sql);
          alert(`Script SQL generado para IONOS DB (${POSTGRES_CONFIG.host}).`);
      } catch (e: any) {
          alert("Error generando SQL: " + e.message);
      } finally {
          setIsGeneratingSql(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700 shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-blue-400">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.047 7.047 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            {t.apiSettings}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t.provider}</label>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>

          <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t.apiKey}</label>
              <input
                type="password"
                value={localConfig.apiKey}
                onChange={(e) => {
                    setLocalConfig({...localConfig, apiKey: e.target.value});
                    setTestResult(null);
                }}
                placeholder={localConfig.provider === 'gemini' ? "AIzaSy..." : "sk-..."}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-slate-600"
              />
            </div>

            {/* Model Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t.model}</label>
              
              {localConfig.provider === 'gemini' ? (
                <div className="relative">
                  <select
                    value={localConfig.model}
                    onChange={(e) => {
                      setLocalConfig({...localConfig, model: e.target.value});
                      setTestResult(null);
                    }}
                    className="w-full appearance-none bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {GEMINI_MODELS.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  type="text"
                  value={localConfig.model}
                  onChange={(e) => {
                      setLocalConfig({...localConfig, model: e.target.value});
                      setTestResult(null);
                  }}
                  placeholder="gpt-4o"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              )}
              
              <p className="text-xs text-slate-500 mt-1">
                {localConfig.provider === 'gemini' ? t.geminiNote : t.openaiNote}
              </p>
            </div>

            {/* Base URL (Only for OpenAI) */}
            {localConfig.provider === 'openai' && (
              <div>
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
              </div>
            )}
          </div>

          {/* Test Area */}
          <div className="space-y-2">
              <div className="flex justify-between items-end">
                <button 
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !localConfig.apiKey}
                    className={`text-xs px-3 py-1 rounded border transition-colors ${
                        isTesting 
                        ? 'bg-slate-700 text-slate-500 border-slate-700 cursor-not-allowed'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                    }`}
                >
                    {isTesting ? t.testing : t.testConnection}
                </button>
              </div>

              {testResult && (
                  <div className={`p-3 rounded-lg border text-xs font-mono break-all whitespace-pre-wrap ${
                      testResult.success 
                        ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' 
                        : 'bg-red-900/30 border-red-500/50 text-red-400'
                  }`}>
                    <span className="font-bold">{testResult.success ? `✓ ${t.success}:` : `✕ ${t.error}:`}</span>
                    {'\n'}{testResult.message}
                  </div>
              )}
          </div>

          {/* IONOS SQL Export Area */}
          <div className="pt-6 border-t border-slate-700">
              <h4 className="text-sm font-bold text-white mb-2">Base de Datos Externa (IONOS)</h4>
              <div className="bg-black/30 p-3 rounded-lg text-[10px] font-mono text-slate-400 mb-3">
                  HOST: {POSTGRES_CONFIG.host}<br/>
                  DB: {POSTGRES_CONFIG.database}<br/>
                  USER: {POSTGRES_CONFIG.user}
              </div>
              <button 
                onClick={handleDownloadSql}
                disabled={isGeneratingSql}
                className="w-full bg-slate-800 hover:bg-indigo-900/50 border border-slate-600 hover:border-indigo-500 text-slate-200 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                  {isGeneratingSql ? 'Generando Script...' : '⬇ Descargar Migración SQL (Sync)'}
              </button>
              <p className="text-[10px] text-slate-500 mt-2 text-center">
                  Genera un archivo .sql para ejecutar en tu servidor PostgreSQL 17.
              </p>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-700 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            {t.cancel}
          </button>
          <button 
            onClick={() => onSave(localConfig)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-900/20 transition-all"
          >
            {t.save}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
