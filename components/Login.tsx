
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
    const { user } = useAuth(); // Monitor global auth state
    const navigate = useNavigate();
    
    const [isRegister, setIsRegister] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // REACTIVE REDIRECT: Fixes the "login twice" issue
    // We wait for the AuthContext to actually receive the user profile before moving to dashboard.
    useEffect(() => {
        if (user) {
            navigate('/app/dashboard');
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setLoading(true);

        const cleanEmail = email.trim();

        try {
            if (isResetting) {
                await authService.sendPasswordResetEmail(cleanEmail);
                setSuccessMessage("Correo de recuperación enviado. Revisa tu bandeja de entrada.");
                setLoading(false); // Reset loading for reset mode only
            } else if (isRegister) {
                await authService.register(cleanEmail, password, name);
                // No need to navigate manually, useEffect will catch the new user
            } else {
                await authService.login(cleanEmail, password);
                // No need to navigate manually, useEffect will catch the user update
            }
        } catch (err: any) {
            setLoading(false); // Only stop loading on error. Success keeps loading until redirect.
            
            let msg = "Error desconocido.";
            switch (err.code) {
                case 'auth/invalid-credential':
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    msg = "Correo o contraseña incorrectos.";
                    break;
                case 'auth/email-already-in-use':
                    msg = "Este correo ya está registrado.";
                    break;
                case 'auth/weak-password':
                    msg = "La contraseña debe tener al menos 6 caracteres.";
                    break;
                case 'auth/operation-not-allowed':
                    msg = "El acceso no está habilitado.";
                    break;
                case 'auth/network-request-failed':
                    msg = "Error de red. Verifica tu conexión.";
                    break;
                case 'auth/too-many-requests':
                    msg = "Demasiados intentos. Espera unos minutos.";
                    break;
                case 'auth/invalid-email':
                    msg = "Formato de correo inválido.";
                    break;
                default:
                    msg = `Error: ${err.code || err.message}`;
            }
            
            if (!isRegister && !isResetting && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) {
                 msg += " (Si es tu primera vez, usa 'Registrarse')";
            }
            setError(msg);
        }
    };

    const toggleMode = (mode: 'login' | 'register' | 'reset') => {
        setError('');
        setSuccessMessage('');
        setLoading(false);
        if (mode === 'reset') {
            setIsResetting(true);
            setIsRegister(false);
        } else if (mode === 'register') {
            setIsResetting(false);
            setIsRegister(true);
        } else {
            setIsResetting(false);
            setIsRegister(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-lg shadow-blue-500/30">
                        CD
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {isResetting ? 'Recuperar Acceso' : (isRegister ? 'Crear Cuenta' : 'Bienvenido')}
                    </h2>
                    <p className="text-slate-400 text-sm">
                        {isResetting 
                            ? 'Ingresa tu correo para restablecer tu contraseña'
                            : (isRegister ? 'Solicita acceso a la Suite' : 'Accede a tu panel de control')}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6 text-center animate-in slide-in-from-top-2">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm mb-6 text-center animate-in slide-in-from-top-2">
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && !isResetting && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre Completo</label>
                            <input 
                                type="text" 
                                required={isRegister}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
                                placeholder="Ej: Juan Pérez"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Correo Electrónico</label>
                        <input 
                            type="email" 
                            required 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
                            placeholder="nombre@empresa.com"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setError(''); }}
                        />
                    </div>

                    {!isResetting && (
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-400 uppercase">Contraseña</label>
                                {!isRegister && (
                                    <button 
                                        type="button"
                                        onClick={() => toggleMode('reset')}
                                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                )}
                            </div>
                            <input 
                                type="password" 
                                required 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                            />
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-900/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        {loading ? 'Procesando...' : (
                            isResetting ? 'Enviar Enlace' : (isRegister ? 'Registrarse' : 'Iniciar Sesión')
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center space-y-2">
                    {isResetting ? (
                        <button 
                            onClick={() => toggleMode('login')}
                            className="text-slate-400 hover:text-white text-sm transition-colors hover:underline underline-offset-4"
                        >
                            ← Volver a Iniciar Sesión
                        </button>
                    ) : (
                        <button 
                            onClick={() => toggleMode(isRegister ? 'login' : 'register')}
                            className="text-slate-400 hover:text-white text-sm transition-colors underline decoration-slate-700 hover:decoration-white underline-offset-4"
                        >
                            {isRegister ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
