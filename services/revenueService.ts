import { RevenueRecord, RevenueStatus } from '../types';
import { DB_PROVIDER, FIREBASE_CONFIG, validateConnectivity } from './config';

export interface IRevenueRepository {
  getRevenues(): Promise<RevenueRecord[]>;
  saveRevenue(record: RevenueRecord): Promise<void>;
  deleteRevenue(id: string): Promise<void>;
}

// --- SCHEMA MIGRATION HELPERS ---
const migrateRevenueRecord = (data: any): RevenueRecord => {
    return {
        id: data.id || crypto.randomUUID(),
        clientName: data.clientName || 'Cliente Sin Nombre',
        amount: typeof data.amount === 'number' ? data.amount : 0,
        status: (['paid', 'pending', 'process'].includes(data.status) ? data.status : 'process') as RevenueStatus,
        employeeId: data.employeeId || '', // Handle missing employee links gracefully
        estimatedDate: data.estimatedDate || Date.now(),
        description: data.description || '', // Ensure optional fields exist
        createdAt: data.createdAt || Date.now()
    };
};

// --- ADAPTER 1: LOCAL STORAGE ---
class LocalStorageRevenueAdapter implements IRevenueRepository {
  private KEY_REVENUE = 'revenue_records';

  async getRevenues(): Promise<RevenueRecord[]> {
    await validateConnectivity();
    const data = localStorage.getItem(this.KEY_REVENUE);
    const raw = data ? JSON.parse(data) : [];
    return raw.map(migrateRevenueRecord);
  }

  async saveRevenue(record: RevenueRecord): Promise<void> {
    await validateConnectivity();
    const records = await this.getRevenues();
    const index = records.findIndex(r => r.id === record.id);
    if (index >= 0) {
      records[index] = record;
    } else {
      records.push(record);
    }
    localStorage.setItem(this.KEY_REVENUE, JSON.stringify(records));
  }

  async deleteRevenue(id: string): Promise<void> {
    await validateConnectivity();
    const records = await this.getRevenues();
    const filtered = records.filter(r => r.id !== id);
    localStorage.setItem(this.KEY_REVENUE, JSON.stringify(filtered));
  }
}

// --- ADAPTER 2: FIREBASE ---
class FirebaseRevenueAdapter implements IRevenueRepository {
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
        console.error("Failed to load Firebase for Revenue", e);
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

  async getRevenues(): Promise<RevenueRecord[]> {
    const db = await this.getDb();
    const { collection, getDocs } = await this.getFirestoreModules();
    const snapshot = await getDocs(collection(db, "revenues"));
    const raw = snapshot.docs.map((d: any) => d.data());
    // Auto-migrate on read to ensure compatibility
    return raw.map(migrateRevenueRecord);
  }

  async saveRevenue(record: RevenueRecord): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    // Use merge: true to protect against overwriting future new fields if this client is outdated
    await setDoc(doc(db, "revenues", record.id), record, { merge: true });
  }

  async deleteRevenue(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "revenues", id));
  }
}

let repository: IRevenueRepository;
if (DB_PROVIDER === 'firebase') {
  repository = new FirebaseRevenueAdapter();
} else {
  repository = new LocalStorageRevenueAdapter();
}
export const revenueService = repository;