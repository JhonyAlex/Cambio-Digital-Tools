
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- GLOBAL ERROR TRAP ---
// Captures errors that happen before React mounts (module loading, syntax, etc)
window.onerror = function(message, source, lineno, colno, error) {
    const root = document.getElementById('root');
    if (root) {
        root.innerHTML = `
            <div style="background:#0f172a; color:#f87171; height:100vh; padding:40px; font-family:sans-serif;">
                <h1 style="font-size:24px; margin-bottom:10px;">Critical System Error</h1>
                <p style="color:#94a3b8;">La aplicación se detuvo por un error inesperado:</p>
                <pre style="background:#1e293b; padding:20px; border-radius:8px; overflow:auto; border:1px solid #334155; margin-top:20px;">
${message}
Location: ${source}:${lineno}:${colno}
                </pre>
                <button onclick="window.location.reload()" style="background:#2563eb; color:white; border:none; padding:10px 20px; border-radius:6px; margin-top:20px; cursor:pointer; font-weight:bold;">
                    Recargar Página
                </button>
            </div>
        `;
    }
    return false;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
} catch (error: any) {
    console.error("React Mount Error:", error);
    // Manually trigger the error UI if createRoot fails
    if (window.onerror) {
        (window.onerror as any)(error.message, "index.tsx", 0, 0, error);
    }
}
