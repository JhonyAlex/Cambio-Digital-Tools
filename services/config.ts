
import { ApiProvider } from '../types';

/**
 * ==============================================================================
 * ARCHIVO DE CONFIGURACIÓN MODULAR (CENTRAL CONFIGURATION)
 * ==============================================================================
 * 
 * 1. DB_PROVIDER: 'local' (Offline) o 'firebase' (Cloud Sync).
 *    - Usa 'local' para probar sin configurar nada (solo guarda en este navegador).
 *    - Usa 'firebase' para guardar en la nube y acceder desde cualquier lugar.
 * 
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. SELECCIÓN DE BASE DE DATOS
// ------------------------------------------------------------------------------
// ACTIVADO: Modo Local por defecto para garantizar estabilidad inicial.
// Cambiar a 'firebase' solo cuando la configuración de Firebase esté validada.
export const DB_PROVIDER: 'local' | 'firebase' = 'local'; 

// ------------------------------------------------------------------------------
// 2. CONFIGURACIÓN GOOGLE CLOUD (FIREBASE)
// ------------------------------------------------------------------------------
// Configuración aplicada desde la consola de Firebase.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDPrrd-Lcesmhr7TC583iL_U1J5XSEatKU",
  authDomain: "cambio-digital-tools.firebaseapp.com",
  projectId: "cambio-digital-tools",
  storageBucket: "cambio-digital-tools.firebasestorage.app",
  messagingSenderId: "760137661582",
  appId: "1:760137661582:web:d7b3777de7b7f059865ddf",
  measurementId: "G-YJPF0LKH4Q"
};

// ------------------------------------------------------------------------------
// 3. ESTRATEGIA DE CONEXIÓN
// ------------------------------------------------------------------------------

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

export const validateConnectivity = async (): Promise<void> => {
  // 1. Check Internet
  if (!navigator.onLine) {
    // In local mode, we allow offline usage, but warn if internet is needed for AI APIs
    // For now, we only throw strict errors for Cloud DB operations
    if ((DB_PROVIDER as string) === 'firebase') {
        throw new ConnectionError("Sin conexión a Internet. El sistema Cloud requiere red.");
    }
  }

  // 2. Check Provider Config
  if ((DB_PROVIDER as string) === 'firebase') {
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes("TU_API_KEY")) {
       console.error("⚠️ ERROR CRÍTICO: Faltan las credenciales de Firebase en services/config.ts");
    }
  }

  return;
};


// ------------------------------------------------------------------------------
// 4. ESTRATEGIA DE API KEY (IA)
// ------------------------------------------------------------------------------
export const getEffectiveApiKey = (provider: ApiProvider, userCustomKey?: string): string => {
  const cleanKey = userCustomKey ? userCustomKey.trim() : '';

  if (provider === 'gemini') {
      // 1. PRIORITY: Custom User Key
      // If the user explicitly provided a key, we use it (overriding the system default)
      if (cleanKey.length >= 10 && !cleanKey.startsWith('YOUR_')) {
          return cleanKey;
      }
      
      // 2. FALLBACK A: Environment Variable (Server/Build time)
      if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
          const envKey = process.env.API_KEY;
          if (envKey && envKey.trim().length >= 10 && !envKey.includes("YOUR_API_KEY")) {
              return envKey.trim();
          }
      } 
      
      // 3. FALLBACK B: Vite/Meta Env
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
          // @ts-ignore
          const viteKey = import.meta.env.VITE_API_KEY;
          if (viteKey && viteKey.length > 10) return viteKey;
      }

      // 4. FALLBACK C: Firebase Config Key (The "Project Key")
      // If no other key is found, we use the Firebase API Key which is often enabled for AI in the same GCP project.
      if (FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes("TU_API_KEY")) {
          return FIREBASE_CONFIG.apiKey;
      }
  } else {
      // OpenAI / Custom Provider / Ollama
      // We do not inject system keys for OpenAI to prevent billing leaks
      if (cleanKey.length > 0) {
          return cleanKey;
      }
  }

  return ''; // Return empty string if no valid key found
};
