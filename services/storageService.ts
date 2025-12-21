import { Project } from '../types';
import { DB_PROVIDER, FIREBASE_CONFIG, validateConnectivity } from './config';

// --- INTERFACE ---
export interface IProjectRepository {
  getProjects(): Promise<Project[]>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  createNewProject(name: string): Promise<Project>;
}

const DB_NAME = 'ChronosDB';
const DB_VERSION = 3; 
const STORE_NAME = 'projects';

/**
 * --- SCHEMA MIGRATION STRATEGY ---
 * Esta función asegura que los datos antiguos siempre tengan la estructura 
 * más reciente definida en types.ts. Se ejecuta en TIEMPO DE LECTURA.
 */
const migrateProjectStructure = (data: any): Project => {
  // 1. Base structure (Version 1)
  const base: Project = {
    id: data.id || crypto.randomUUID(),
    name: data.name || 'Sin Nombre',
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    files: Array.isArray(data.files) ? data.files : [],
    chatHistory: Array.isArray(data.chatHistory) ? data.chatHistory : [],
    // Defaults for newer versions:
    tags: Array.isArray(data.tags) ? data.tags : [],
    settings: {
        autoSummarize: data.settings?.autoSummarize ?? true,
        language: data.settings?.language || 'es',
        exportFormat: data.settings?.exportFormat || 'md'
    },
    schemaVersion: DB_VERSION,
    sessions: Array.isArray(data.sessions) ? data.sessions : []
  };

  return base;
};

const sanitizeProjectForSave = (project: Project): Project => {
  return {
    ...project,
    // Ensure files don't contain non-serializable File objects
    files: project.files.map(f => {
      const { file, ...rest } = f; 
      return rest;
    }),
    updatedAt: Date.now()
  };
};

// --- ADAPTER 1: INDEXED DB (LOCAL) ---
class IndexedDBAdapter implements IProjectRepository {
  
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject("Error opening database");
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  async getProjects(): Promise<Project[]> {
    await validateConnectivity();
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const raw = request.result as any[];
          // Aplicar migración al vuelo
          const projects = raw.map(p => migrateProjectStructure(p));
          resolve(projects);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("Error getting projects:", e);
      return [];
    }
  }

  async saveProject(project: Project): Promise<void> {
    await validateConnectivity();
    const db = await this.openDB();
    const cleanProject = sanitizeProjectForSave(project);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cleanProject);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    await validateConnectivity();
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async createNewProject(name: string): Promise<Project> {
    await validateConnectivity();
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Nuevo Proyecto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files: [],
      chatHistory: [],
      tags: [],
      settings: { autoSummarize: true, language: 'es', exportFormat: 'md' },
      schemaVersion: DB_VERSION,
      sessions: []
    };
    await this.saveProject(newProject);
    return newProject;
  }
}

// --- ADAPTER 2: FIREBASE (CLOUD) ---
class FirebaseProjectAdapter implements IProjectRepository {
  private db: any;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.isInitialized) return;
    try {
        // @ts-ignore
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        // @ts-ignore
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const app = initializeApp(FIREBASE_CONFIG);
        this.db = getFirestore(app);
        this.isInitialized = true;
    } catch (e) {
        console.error("Failed to load Firebase for Chronos", e);
    }
  }

  private async getDb() {
    await validateConnectivity(); // Critical Check
    if (!this.isInitialized) await this.init();
    if (!this.db) throw new Error("Firebase DB not initialized.");
    return this.db;
  }

  private async getFirestoreModules() {
      // @ts-ignore
      return await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
  }

  async getProjects(): Promise<Project[]> {
    const db = await this.getDb();
    const { collection, getDocs } = await this.getFirestoreModules();
    
    // Firestore Collection: "projects"
    // Si no existe, Firebase retornará array vacío (no error).
    const snapshot = await getDocs(collection(db, "projects"));
    const raw = snapshot.docs.map((d: any) => d.data());
    
    // Aplicar migración al vuelo para asegurar integridad
    return raw.map((p: any) => migrateProjectStructure(p));
  }

  async saveProject(project: Project): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    const cleanProject = sanitizeProjectForSave(project);
    
    // setDoc con merge: true para seguridad extra, aunque aquí reemplazamos el documento completo del proyecto
    // para asegurar que las eliminaciones de archivos se reflejen.
    await setDoc(doc(db, "projects", project.id), cleanProject);
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "projects", id));
  }

  async createNewProject(name: string): Promise<Project> {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Nuevo Proyecto Cloud',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files: [],
      chatHistory: [],
      tags: [],
      settings: { autoSummarize: true, language: 'es', exportFormat: 'md' },
      schemaVersion: DB_VERSION,
      sessions: []
    };
    await this.saveProject(newProject);
    return newProject;
  }
}

let repository: IProjectRepository;
if (DB_PROVIDER === 'firebase') {
  repository = new FirebaseProjectAdapter();
} else {
  repository = new IndexedDBAdapter();
}

export const getProjects = () => repository.getProjects();
export const saveProject = (p: Project) => repository.saveProject(p);
export const deleteProject = (id: string) => repository.deleteProject(id);
export const createNewProject = (name: string) => repository.createNewProject(name);