
// Servicio dedicado a guardar los archivos binarios (Audio, Imágenes, PDF) 
// exclusivamente en el navegador del usuario para no saturar la base de datos en la nube.

const DB_NAME = 'ChronosBlobs';
const STORE_NAME = 'files';
const DB_VERSION = 1;

class LocalBlobService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME); // Key is the file ID
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };
      
      request.onerror = (event) => {
        console.error("IndexedDB Error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
    
    return this.dbPromise;
  }

  async saveFile(id: string, file: File | Blob): Promise<void> {
    const db = await this.getDB();
    if (!db) throw new Error("IndexedDB connection failed");

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(file, id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFile(id: string): Promise<Blob | null> {
    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result ? (request.result as Blob) : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(id: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async copyFile(sourceId: string, targetId: string): Promise<void> {
      const db = await this.getDB();
      if (!db) return;

      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          
          // 1. Get Source
          const getReq = store.get(sourceId);
          
          getReq.onsuccess = () => {
              const blob = getReq.result;
              if (blob) {
                  // 2. Put Target
                  const putReq = store.put(blob, targetId);
                  putReq.onsuccess = () => resolve();
                  putReq.onerror = () => reject(putReq.error);
              } else {
                  // Source doesn't exist, skip (maybe it was a text file or link)
                  resolve(); 
              }
          };
          
          getReq.onerror = () => reject(getReq.error);
      });
  }
}

export const localBlobService = new LocalBlobService();
