/**
 * NOTA: Este servicio está diseñado para ejecutarse en el servidor Node.js,
 * NO en el navegador. El navegador no puede conectarse directamente a PostgreSQL.
 * 
 * Para uso en el navegador, usar apiAdapter.ts que se comunica con el servidor Express.
 * La lógica de base de datos real está en server/index.js
 */

export const testConnection = async (): Promise<boolean> => {
  console.warn('testConnection no está disponible en el navegador. Use el backend API.');
  return false;
};

export const runMigrations = async (): Promise<void> => {
  console.warn('runMigrations no está disponible en el navegador. Use npm run db:init desde la terminal.');
};

export const query = async (_text: string, _params?: any[]) => {
  throw new Error('query() no está disponible en el navegador. Use el backend API.');
};

export const getClient = async () => {
  throw new Error('getClient() no está disponible en el navegador. Use el backend API.');
};

export const closePool = async () => {
  console.warn('closePool no está disponible en el navegador.');
};

export const getPool = () => {
  throw new Error('getPool() no está disponible en el navegador. Use el backend API.');
};

export default {
  testConnection,
  runMigrations,
  query,
  getClient,
  closePool,
  getPool
};
