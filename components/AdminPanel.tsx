
import React, { useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { TOOLS } from '../toolsRegistry';

const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        const all = await authService.getAllUsers();
        setUsers(all);
        setLoading(false);
    };

    const togglePermission = async (user: UserProfile, perm: keyof typeof user.permissions) => {
        if (currentUser && user.uid === currentUser.uid && user.role === 'admin') return; 
        const updatedPerms = { ...user.permissions, [perm]: !user.permissions[perm] };
        setUsers(users.map(u => u.uid === user.uid ? { ...u, permissions: updatedPerms } : u));
        await authService.updateUserProfile(user.uid, { permissions: updatedPerms });
    };

    const approveUser = async (user: UserProfile) => {
        const defaultPerms: any = {};
        // Default to enabled for communication/productivity tools, disabled for sensitive finance
        TOOLS.forEach(tool => {
            const isSensitive = tool.group === 'finance';
            defaultPerms[tool.perm] = !isSensitive;
        });

        const updated = { ...user, role: 'user' as const, permissions: defaultPerms };
        setUsers(users.map(u => u.uid === user.uid ? updated : u));
        await authService.updateUserProfile(user.uid, { role: 'user', permissions: defaultPerms });
    };

    const toggleAdmin = async (user: UserProfile) => {
        if (currentUser && user.uid === currentUser.uid) { alert("No puedes cambiar tu propio rol."); return; }
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        
        let newPerms = user.permissions;
        if (newRole === 'admin') {
            // Grant all permissions
            const allPerms: any = {};
            TOOLS.forEach(t => allPerms[t.perm] = true);
            newPerms = allPerms;
        }

        setUsers(users.map(u => u.uid === user.uid ? { ...u, role: newRole, permissions: newPerms } : u));
        await authService.updateUserProfile(user.uid, { role: newRole, permissions: newPerms });
    };

    const deleteUser = async (user: UserProfile) => {
        if (currentUser && user.uid === currentUser.uid) { alert("No puedes eliminar tu propia cuenta."); return; }
        if (confirm(`⚠️ PELIGRO ⚠️\n\n¿Estás seguro de ELIMINAR al usuario "${user.displayName || user.email}"?`)) {
            try {
                await authService.deleteUser(user.uid);
                setUsers(users.filter(u => u.uid !== user.uid));
            } catch (e: any) { alert("Error: " + e.message); }
        }
    }

    // Helper for checkbox accent colors
    const getAccentClass = (color: string) => {
        switch(color) {
            case 'blue': return 'accent-blue-500';
            case 'indigo': return 'accent-indigo-500';
            case 'fuchsia': return 'accent-fuchsia-500';
            case 'cyan': return 'accent-cyan-500';
            case 'amber': return 'accent-amber-500';
            case 'emerald': return 'accent-emerald-500';
            case 'violet': return 'accent-violet-500';
            default: return 'accent-slate-500';
        }
    };

    const getHeaderClass = (color: string) => {
        switch(color) {
            case 'blue': return 'text-blue-400';
            case 'indigo': return 'text-indigo-400';
            case 'fuchsia': return 'text-fuchsia-400';
            case 'cyan': return 'text-cyan-400';
            case 'amber': return 'text-amber-400';
            case 'emerald': return 'text-emerald-400';
            case 'violet': return 'text-violet-400';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-7xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <span className="bg-amber-500/20 text-amber-500 p-2 rounded-lg">🛡️</span>
                            Panel Maestro
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Gestión de Usuarios y Permisos</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg border border-slate-700">✕ Cerrar</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#0b1120]">
                    
                    {loading ? <div className="text-center py-20 text-slate-500">Cargando...</div> : (
                        <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="text-slate-500 text-xs font-bold uppercase border-b border-slate-800 bg-slate-900/50">
                                    <th className="py-4 px-4 sticky left-0 bg-slate-900/95 z-10">Usuario</th>
                                    <th className="py-4 px-4">Rol</th>
                                    {/* DYNAMIC HEADERS FROM REGISTRY */}
                                    {TOOLS.map(tool => (
                                        <th key={tool.id} className={`py-4 px-4 text-center ${getHeaderClass(tool.color)}`}>
                                            {tool.shortLabel}
                                        </th>
                                    ))}
                                    <th className="py-4 px-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {users.map(u => (
                                    <tr key={u.uid} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="py-4 px-4 sticky left-0 bg-[#0b1120] hover:bg-slate-800/40 z-10">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${u.role === 'admin' ? 'bg-amber-600' : 'bg-slate-700'}`}>
                                                    {u.displayName?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-sm">{u.displayName || 'Sin Nombre'}</div>
                                                    <div className="text-xs text-slate-500">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${
                                                u.role === 'admin' ? 'bg-amber-900/30 text-amber-400 border-amber-500/30' :
                                                u.role === 'user' ? 'bg-blue-900/30 text-blue-400 border-blue-500/30' :
                                                'bg-slate-800 text-slate-400 border-slate-700'
                                            }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        
                                        {/* DYNAMIC PERMISSIONS TOGGLES */}
                                        {TOOLS.map(tool => (
                                            <td key={tool.id} className="text-center">
                                                <input 
                                                    type="checkbox" 
                                                    disabled={u.role==='pending' || (u.role==='admin' && currentUser?.uid === u.uid)} 
                                                    checked={!!u.permissions?.[tool.perm]} 
                                                    onChange={()=>togglePermission(u, tool.perm)} 
                                                    className={`${getAccentClass(tool.color)} cursor-pointer w-4 h-4 rounded`}
                                                />
                                            </td>
                                        ))}
                                        
                                        <td className="py-4 px-4 text-right">
                                            <div className="flex justify-end gap-2 items-center">
                                                {u.role === 'pending' ? (
                                                    <button onClick={() => approveUser(u)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded shadow-lg shadow-emerald-900/20">Autorizar</button>
                                                ) : (
                                                    <button onClick={() => toggleAdmin(u)} disabled={currentUser?.uid === u.uid} className={`text-xs px-3 py-1.5 rounded border transition-colors ${currentUser?.uid === u.uid ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`}>{u.role === 'admin' ? 'Degradar' : 'Hacer Admin'}</button>
                                                )}
                                                <button onClick={() => deleteUser(u)} disabled={currentUser?.uid === u.uid} className={`p-1.5 rounded transition-colors ${currentUser?.uid === u.uid ? 'opacity-30 cursor-not-allowed text-slate-600' : 'text-red-400 hover:bg-red-900/30 hover:text-red-300'}`} title="Eliminar Usuario">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
