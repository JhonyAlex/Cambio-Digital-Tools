
import React, { useState, useEffect } from 'react';
import { PayrollConfig, RoleDefinition } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: PayrollConfig;
  onSave: (config: PayrollConfig) => void;
}

const FinancialConfigModal: React.FC<Props> = ({ isOpen, onClose, config, onSave }) => {
  const [formData, setFormData] = useState<PayrollConfig>(config);

  useEffect(() => {
    if (isOpen) {
      setFormData(JSON.parse(JSON.stringify(config))); // Deep copy
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleRoleChange = (index: number, field: keyof RoleDefinition, value: any) => {
    const newRoles = [...formData.roles];
    newRoles[index] = { ...newRoles[index], [field]: value };
    setFormData({ ...formData, roles: newRoles });
  };

  const handleAddRole = () => {
    setFormData({
      ...formData,
      roles: [...formData.roles, { id: crypto.randomUUID(), name: 'Nuevo Rol', multiplier: 1.0 }]
    });
  };

  const handleRemoveRole = (index: number) => {
    const newRoles = [...formData.roles];
    newRoles.splice(index, 1);
    setFormData({ ...formData, roles: newRoles });
  };

  const handleSubmit = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              ⚙️ Configuración Financiera
            </h3>
            <p className="text-slate-400 text-sm">Parámetros globales de nómina y tesorería.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">✕</button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 bg-[#0b1120]">
          
          {/* Section 1: Global Values */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider border-b border-blue-900/30 pb-2">Valores Base</h4>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Salario Base (Auxiliar)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                <input 
                  type="number" 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-7 pr-3 text-white focus:border-blue-500 outline-none font-mono"
                  value={formData.baseSalary}
                  onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Base para el cálculo de multiplicadores de nómina.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Tasa de Cambio (EUR → COP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                  <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-7 pr-3 text-white focus:border-amber-500 outline-none font-mono"
                    value={formData.euroExchangeRate}
                    onChange={(e) => setFormData({ ...formData, euroExchangeRate: Number(e.target.value) })}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">1 Euro = {formData.euroExchangeRate} Pesos</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Tasa de Cambio (USD → COP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                  <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-7 pr-3 text-white focus:border-emerald-500 outline-none font-mono"
                    value={formData.usdExchangeRate || 4000}
                    onChange={(e) => setFormData({ ...formData, usdExchangeRate: Number(e.target.value) })}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">1 Dólar = {formData.usdExchangeRate || 4000} Pesos</p>
              </div>
            </div>
          </div>

          {/* Section 2: Roles Definition */}
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-amber-900/30 pb-2">
               <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Definición de Roles</h4>
               <button onClick={handleAddRole} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 transition-colors">+ Agregar Rol</button>
            </div>
            
            <div className="space-y-3">
              {formData.roles.map((role, idx) => (
                <div key={idx} className="flex gap-3 items-center bg-slate-900 p-3 rounded-xl border border-slate-800 group hover:border-slate-700 transition-colors">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-0.5 block">Nombre del Cargo</label>
                    <input 
                      type="text" 
                      value={role.name}
                      onChange={(e) => handleRoleChange(idx, 'name', e.target.value)}
                      className="w-full bg-transparent border-b border-slate-700 focus:border-blue-500 text-white text-sm outline-none py-1"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-0.5 block">Multiplicador</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 text-xs">x</span>
                      <input 
                        type="number" 
                        step="0.1"
                        value={role.multiplier}
                        onChange={(e) => handleRoleChange(idx, 'multiplier', Number(e.target.value))}
                        className="w-full bg-transparent border-b border-slate-700 focus:border-amber-500 text-amber-400 font-bold text-sm outline-none py-1 text-center"
                      />
                    </div>
                  </div>
                  <div className="w-32 text-right">
                     <label className="text-[10px] text-slate-500 font-bold uppercase mb-0.5 block">Sueldo Calc.</label>
                     <p className="text-emerald-400 font-mono text-sm font-bold">
                       ${(formData.baseSalary * role.multiplier).toLocaleString()}
                     </p>
                  </div>
                  <button onClick={() => handleRemoveRole(idx)} className="text-slate-600 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Legal Terms Config (NEW) */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wider border-b border-cyan-900/30 pb-2">Directrices de Presupuestos</h4>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Directrices de Términos y Condiciones</label>
              <p className="text-[10px] text-slate-500 mb-2">
                Define aquí las reglas globales para que la IA genere los términos (ej: Pagos 50/50, Validez 15 días, Tiempos de entrega). Si lo dejas vacío, la IA usará un estándar comercial.
              </p>
              <textarea 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 outline-none text-sm h-32 leading-relaxed"
                placeholder="- Forma de pago: 50% anticipo, 50% contra entrega.
- Validez de la oferta: 15 días calendario.
- Tiempos de entrega: A convenir según disponibilidad.
- Garantía: 1 año sobre defectos de fábrica."
                value={formData.termsGuidelines || ''}
                onChange={(e) => setFormData({ ...formData, termsGuidelines: e.target.value })}
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all">Guardar Cambios</button>
        </div>

      </div>
    </div>
  );
};

export default FinancialConfigModal;
