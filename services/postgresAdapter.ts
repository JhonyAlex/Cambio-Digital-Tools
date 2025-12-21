/**
 * NOTA: Este adaptador NO se utiliza en la versión actual.
 * 
 * La aplicación web usa apiAdapter.ts que se comunica con el backend Express.
 * El navegador no puede conectarse directamente a PostgreSQL por seguridad.
 * 
 * La lógica real de PostgreSQL está en server/index.js
 */

import { Project } from '../types';
import { IProjectRepository } from './storageService';

/**
 * Adaptador PostgreSQL DESHABILITADO
 * NO USAR - Solo para referencia
 * 
 * En el frontend, usar APIAdapter (apiAdapter.ts)
 */
export class PostgreSQLAdapter implements IProjectRepository {
  async getProjects(): Promise<Project[]> {
    throw new Error('PostgreSQLAdapter está deshabilitado. Use APIAdapter en su lugar.');
  }
  
  async saveProject(_project: Project): Promise<void> {
    throw new Error('PostgreSQLAdapter está deshabilitado. Use APIAdapter en su lugar.');
  }
  
  async deleteProject(_id: string): Promise<void> {
    throw new Error('PostgreSQLAdapter está deshabilitado. Use APIAdapter en su lugar.');
  }
  
  async createNewProject(_name: string): Promise<Project> {
    throw new Error('PostgreSQLAdapter está deshabilitado. Use APIAdapter en su lugar.');
  }
}
