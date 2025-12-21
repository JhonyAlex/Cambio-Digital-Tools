import React, { useEffect, useState } from 'react';
import { DB_PROVIDER } from '../services/config';

interface DatabaseInitProps {
  children: React.ReactNode;
}

/**
 * Componente que verifica la disponibilidad del backend API
 */
export const DatabaseInit: React.FC<DatabaseInitProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    const checkBackend = async () => {
      // Si no estamos usando PostgreSQL, no necesitamos verificar el backend
      if (DB_PROVIDER !== 'postgresql') {
        setIsReady(true);
        return;
      }

      setIsInitializing(true);
      
      try {
        console.log('🔄 Verificando backend API...');
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_URL}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error('Backend API no está disponible');
        }

        const data = await response.json();
        if (data.status !== 'ok') {
          throw new Error('Backend API reporta error de conexión');
        }
        
        console.log('✅ Backend API disponible');
        setIsReady(true);
      } catch (err) {
        console.error('❌ Error al conectar con el backend:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsInitializing(false);
      }
    };

    checkBackend();
  }, []);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        padding: '2rem',
        backgroundColor: '#1a1a1a',
        color: '#fff'
      }}>
        <div style={{
          maxWidth: '600px',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#ff4444', marginBottom: '1rem' }}>
            ❌ Error de Conexión al Backend API
          </h1>
          <p style={{ 
            backgroundColor: '#2a2a2a', 
            padding: '1rem', 
            borderRadius: '8px',
            marginBottom: '1rem',
            fontFamily: 'monospace'
          }}>
            {error}
          </p>
          <div style={{ 
            backgroundColor: '#2a2a2a', 
            padding: '1rem', 
            borderRadius: '8px',
            textAlign: 'left',
            fontSize: '0.9rem'
          }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
              💡 Posibles soluciones:
            </p>
            <ul style={{ marginLeft: '1.5rem' }}>
              <li>Inicia el backend: <code>npm run server</code></li>
              <li>Verifica que el backend esté en http://localhost:3001</li>
              <li>Confirma que la variable VITE_API_URL esté configurada en .env</li>
              <li>Revisa que PostgreSQL esté accesible desde el servidor</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 2rem',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            🔄 Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #333',
            borderTop: '4px solid #4CAF50',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}></div>
          <h2 style={{ marginBottom: '0.5rem' }}>
            {isInitializing ? '🔄 Conectando al Backend...' : '⏳ Preparando aplicación...'}
          </h2>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            {isInitializing ? 'Verificando disponibilidad del servidor API' : 'Por favor espera'}
          </p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
};
