
import { ApiProvider } from '../types';

/**
 * ==============================================================================
 * CONFIGURACIÓN SEGURA PARA NAVEGADOR
 * ==============================================================================
 * Se han eliminado dependencias de 'process' o 'import.meta' que pueden
 * causar fallos críticos (White Screen of Death) en entornos web puros.
 */

// 1. SELECCIÓN DE BASE DE DATOS
// Cambiado a 'firebase' para recuperar los datos de la nube.
export const DB_PROVIDER: 'local' | 'firebase' = 'firebase'; 

// 2. CONFIGURACIÓN FIREBASE (Hardcoded Safe)
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDPrrd-Lcesmhr7TC583iL_U1J5XSEatKU",
  authDomain: "cambio-digital-tools.firebaseapp.com",
  projectId: "cambio-digital-tools",
  storageBucket: "cambio-digital-tools.firebasestorage.app",
  messagingSenderId: "760137661582",
  appId: "1:760137661582:web:d7b3777de7b7f059865ddf",
  measurementId: "G-YJPF0LKH4Q"
};

// 3. ESTRATEGIA DE CONEXIÓN
export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

export const validateConnectivity = async (): Promise<void> => {
  // Casting explícito para evitar errores de tipo en comparaciones estrictas
  if (!navigator.onLine && (DB_PROVIDER as string) === 'firebase') {
      throw new ConnectionError("Sin conexión a Internet.");
  }
  return;
};

// 4. ESTRATEGIA DE API KEY (IA)
export const getEffectiveApiKey = (provider: ApiProvider, userCustomKey?: string): string => {
  // 1. Si el usuario puso su propia clave, usarla.
  if (userCustomKey && userCustomKey.trim().length >= 10) {
      return userCustomKey.trim();
  }

  // 2. Fallback seguro: Usar la clave pública de Firebase si es Gemini
  // (Esto evita buscar en process.env que puede romper la app)
  if (provider === 'gemini') {
      return FIREBASE_CONFIG.apiKey;
  }

  return '';
};
