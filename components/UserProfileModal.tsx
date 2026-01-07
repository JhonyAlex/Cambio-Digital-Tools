
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const UserProfileModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen || !user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
        // 1. Update Display Name
        if (displayName !== user.displayName) {
            await authService.updateUserProfile(user.uid, { displayName });
        }

        // 2. Update Password (if provided)
        if (newPassword) {
            if (newPassword.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
            if (newPassword !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
            
            await authService.updatePassword(newPassword);
        }

        await refreshUser();
        setMessage({ text: "Perfil actualizado correctamente.", type: 'success' });
        setNewPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        console.error(error);
        setMessage({ text: error.message || "Error al actualizar perfil.", type: 'error' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm">
                    {user.displayName?.charAt(0) || 'U'}
                </div>
                Mi Perfil
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
            {message && (
                <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Correo Electrónico</label>
                    <input 
                        type="email" 
                        value={user.email} 
                        disabled 
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-500 cursor-not-allowed"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre Completo</label>
                    <input 
                        type="text" 
                        value={displayName} 
                        onChange={e => setDisplayName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                    />
                </div>

                <div className="pt-4 border-t border-slate-800">
                    <p className="text-xs text-blue-400 mb-3 font-bold uppercase">Cambiar Contraseña</p>
                    
                    <div className="space-y-3">
                        <input 
                            type="password" 
                            placeholder="Nueva contraseña (opcional)"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                        />
                        <input 
                            type="password" 
                            placeholder="Confirmar contraseña"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className={`w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none ${newPassword && newPassword !== confirmPassword ? 'border-red-500' : ''}`}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancelar</button>
                <button 
                    type="submit" 
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50"
                >
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>
        </form>

      </div>
    </div>
  );
};

export default UserProfileModal;
