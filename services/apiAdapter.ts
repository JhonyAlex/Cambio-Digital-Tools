import { Project } from '../types';
import { IProjectRepository } from './storageService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Adaptador API para gestión de proyectos
 * Se comunica con el backend Express que maneja PostgreSQL
 */
export class APIAdapter implements IProjectRepository {
  
  /**
   * Obtener todos los proyectos
   */
  async getProjects(): Promise<Project[]> {
    try {
      const response = await fetch(`${API_URL}/projects`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const projects = await response.json();
      return projects;
    } catch (error) {
      console.error('Error obteniendo proyectos desde la API:', error);
      throw error;
    }
  }
  
  /**
   * Guardar o actualizar un proyecto
   */
  async saveProject(project: Project): Promise<void> {
    try {
      // Verificar si el proyecto ya existe
      const existsResponse = await fetch(`${API_URL}/projects/${project.id}`);
      const exists = existsResponse.ok;
      
      const cleanProject = this.sanitizeProjectForSave(project);
      
      if (exists) {
        // Actualizar proyecto existente
        const response = await fetch(`${API_URL}/projects/${project.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cleanProject),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } else {
        // Crear nuevo proyecto
        const response = await fetch(`${API_URL}/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cleanProject),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('Error guardando proyecto en la API:', error);
      throw error;
    }
  }
  
  /**
   * Eliminar un proyecto
   */
  async deleteProject(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/projects/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error eliminando proyecto desde la API:', error);
      throw error;
    }
  }
  
  /**
   * Crear un nuevo proyecto
   */
  async createNewProject(name: string): Promise<Project> {
    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const newProject = await response.json();
      return newProject;
    } catch (error) {
      console.error('Error creando proyecto en la API:', error);
      throw error;
    }
  }
  
  /**
   * Sanitizar proyecto antes de enviar a la API
   */
  private sanitizeProjectForSave(project: Project): Project {
    return {
      ...project,
      // Asegurar que los archivos no contengan objetos File no serializables
      files: project.files.map(f => {
        const { file, ...rest } = f; 
        return rest;
      }),
      updatedAt: Date.now()
    };
  }
  
  /**
   * Verificar la salud de la API
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      return data.status === 'ok' && data.database === 'connected';
    } catch (error) {
      console.error('Error verificando salud de la API:', error);
      return false;
    }
  }
}
