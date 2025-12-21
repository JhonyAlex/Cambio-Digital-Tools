
/**
 * ==============================================================================
 * ARCHIVO DE CONFIGURACIÓN MODULAR (CENTRAL CONFIGURATION)
 * ==============================================================================
 * 
 * !!! ATENCIÓN IA / DESARROLLADOR !!!
 * Este archivo es el corazón de la infraestructura.
 * 
 * 1. DB_PROVIDER controla si la app es Local o Cloud.
 * 2. validateConnectivity() es el "Kill Switch". DEBE ser llamado
 *    al inicio de CUALQUIER operación de base de datos en los servicios.
 *    NO ELIMINAR NI BYPASSEAR ESTA VALIDACIÓN.
 * 
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. SELECCIÓN DE BASE DE DATOS
// ------------------------------------------------------------------------------
// Opciones disponibles:
// - 'local': IndexedDB del navegador
// - 'firebase': Firebase Cloud Firestore
// - 'postgresql': PostgreSQL en servidor remoto (IONOS)
//
// PARA ACTIVAR MODO CLOUD (PRODUCCIÓN):
// 1. Cambia esto a 'firebase' o 'postgresql'.
// 2. Rellena el objeto correspondiente abajo con tus datos reales.
export const DB_PROVIDER: 'local' | 'firebase' | 'postgresql' = 'postgresql'; 

// ------------------------------------------------------------------------------
// 2. CONFIGURACIÓN GOOGLE CLOUD (FIREBASE)
// ------------------------------------------------------------------------------
// Si DB_PROVIDER es 'firebase', llena estos datos de tu consola de Firebase.
export const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY_DE_FIREBASE",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-id",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "00000000000",
  appId: "1:00000000000:web:00000000000000"
};

// ------------------------------------------------------------------------------
// 3. CONFIGURACIÓN POSTGRESQL (IONOS)
// ------------------------------------------------------------------------------
// IMPORTANTE: Esta configuración se usa para conectar al servidor PostgreSQL remoto.
// Los datos de conexión se cargan desde las variables de entorno (.env).
export const POSTGRES_CONFIG = {
  host: import.meta.env.VITE_DB_HOST || "74.208.125.117",
  port: parseInt(import.meta.env.VITE_DB_PORT || "5432"),
  database: import.meta.env.VITE_DB_NAME || "herramientascd",
  user: import.meta.env.VITE_DB_USER || "jhony",
  password: import.meta.env.VITE_DB_PASSWORD || "vcDDw5QiFT7G",
  connectionString: import.meta.env.VITE_DATABASE_URL || "postgresql://jhony:vcDDw5QiFT7G@74.208.125.117:5432/herramientascd"
};

// ------------------------------------------------------------------------------
// 4. ESTRATEGIA DE CONEXIÓN (STRICT MODE)
// ------------------------------------------------------------------------------

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

/**
 * Verifica estrictamente la conexión antes de cualquier operación crítica.
 * Si esto falla, el sistema DEBE detenerse.
 * 
 * Para cambiar de proveedor (ej: Supabase, AWS), solo modifica esta función.
 */
export const validateConnectivity = async (): Promise<void> => {
  // 1. Verificación básica de Internet (Nivel Navegador)
  if (!navigator.onLine) {
    throw new ConnectionError("Sin conexión a Internet. El sistema requiere conexión constante.");
  }

  // 2. Verificación específica del proveedor
  if ((DB_PROVIDER as string) === 'firebase') {
    // Verificación de seguridad: Evitar conexión con credenciales por defecto
    if (FIREBASE_CONFIG.apiKey === "TU_API_KEY_DE_FIREBASE" || FIREBASE_CONFIG.projectId === "tu-proyecto-id") {
       console.error("CRITICAL: Firebase está habilitado pero las credenciales son las predeterminadas.");
       throw new ConnectionError("Error de Configuración: Credenciales de Firebase no configuradas en services/config.ts");
    }
    
    // Aquí podríamos hacer un "Ping" ligero a Firestore si se requiere una verificación profunda.
    try {
        // Simulación de check rápido
        return; 
    } catch (e) {
        throw new ConnectionError("No se puede contactar con Google Cloud Firestore.");
    }
  }

  if ((DB_PROVIDER as string) === 'postgresql') {
    // Verificación de que las credenciales están configuradas
    if (!POSTGRES_CONFIG.connectionString || POSTGRES_CONFIG.connectionString.includes('your_')) {
      console.error("CRITICAL: PostgreSQL está habilitado pero las credenciales no están configuradas.");
      throw new ConnectionError("Error de Configuración: Credenciales de PostgreSQL no configuradas. Verifica tu archivo .env");
    }
    // La validación real de conexión se hace en databaseService.ts
    return;
  }

  // Si es local, siempre "funciona" (mientras haya navegador)
  return;
};


// ------------------------------------------------------------------------------
// 5. ESTRATEGIA DE API KEY (IA)
// ------------------------------------------------------------------------------
export const getEffectiveApiKey = (userCustomKey?: string): string => {
  if (userCustomKey && isValidKey(userCustomKey)) {
    return userCustomKey;
  }
  
  const envKey = process.env.API_KEY;
  if (envKey && isValidKey(envKey)) {
    return envKey;
  }

  return '';
};

const isValidKey = (key: string): boolean => {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed !== 'undefined' && 
    trimmed !== 'null' && 
    trimmed.length > 10 && 
    !trimmed.startsWith('YOUR_') &&
    !trimmed.includes('INSERT_API_KEY')
  );
};
