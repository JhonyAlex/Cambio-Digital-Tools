
import { RevenueRecord, RevenueStatus, ExpenseRecord } from '../types';
import { DB_PROVIDER, FIREBASE_CONFIG, validateConnectivity } from './config';

export interface IFinanceRepository {
  // Revenues
  getRevenues(): Promise<RevenueRecord[]>;
  saveRevenue(record: RevenueRecord): Promise<void>;
  deleteRevenue(id: string): Promise<void>;
  
  // Expenses
  getExpenses(): Promise<ExpenseRecord[]>;
  saveExpense(record: ExpenseRecord): Promise<void>;
  deleteExpense(id: string): Promise<void>;
}

// --- HELPERS ---
const migrateRevenueRecord = (data: any): RevenueRecord => ({
    id: data.id || crypto.randomUUID(),
    clientName: data.clientName || 'Cliente Sin Nombre',
    amount: typeof data.amount === 'number' ? data.amount : 0,
    status: (['paid', 'pending', 'process'].includes(data.status) ? data.status : 'process') as RevenueStatus,
    employeeId: data.employeeId || '',
    estimatedDate: data.estimatedDate || Date.now(),
    description: data.description || '',
    createdAt: data.createdAt || Date.now(),
    targetWalletId: data.targetWalletId,
    createdBy: data.createdBy || '' // NEW
});

const migrateExpenseRecord = (data: any): ExpenseRecord => ({
    id: data.id || crypto.randomUUID(),
    title: data.title || 'Gasto General',
    amount: typeof data.amount === 'number' ? data.amount : 0,
    category: data.category || 'other',
    date: data.date || Date.now(),
    description: data.description || '',
    sourceWalletId: data.sourceWalletId,
    createdBy: data.createdBy || '' // NEW
});

// --- ADAPTER 1: LOCAL STORAGE ---
class LocalStorageFinanceAdapter implements IFinanceRepository {
  private KEY_REVENUE = 'revenue_records';
  private KEY_EXPENSE = 'expense_records';

  // -- Revenues --
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
    if (index >= 0) records[index] = record;
    else records.push(record);
    localStorage.setItem(this.KEY_REVENUE, JSON.stringify(records));
  }

  async deleteRevenue(id: string): Promise<void> {
    await validateConnectivity();
    const records = await this.getRevenues();
    const filtered = records.filter(r => r.id !== id);
    localStorage.setItem(this.KEY_REVENUE, JSON.stringify(filtered));
  }

  // -- Expenses --
  async getExpenses(): Promise<ExpenseRecord[]> {
    await validateConnectivity();
    const data = localStorage.getItem(this.KEY_EXPENSE);
    const raw = data ? JSON.parse(data) : [];
    return raw.map(migrateExpenseRecord);
  }

  async saveExpense(record: ExpenseRecord): Promise<void> {
    await validateConnectivity();
    const records = await this.getExpenses();
    const index = records.findIndex(r => r.id === record.id);
    if (index >= 0) records[index] = record;
    else records.push(record);
    localStorage.setItem(this.KEY_EXPENSE, JSON.stringify(records));
  }

  async deleteExpense(id: string): Promise<void> {
    await validateConnectivity();
    const records = await this.getExpenses();
    const filtered = records.filter(r => r.id !== id);
    localStorage.setItem(this.KEY_EXPENSE, JSON.stringify(filtered));
  }
}

// --- ADAPTER 2: FIREBASE ---
class FirebaseFinanceAdapter implements IFinanceRepository {
  private db: any;
  private isInitialized = false;

  constructor() { this.init(); }

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
    } catch (e) { console.error("Firebase Finance Init Error", e); }
  }

  private async getDb() {
    await validateConnectivity();
    if (!this.isInitialized) await this.init();
    if (!this.db) throw new Error("Firebase DB not initialized.");
    return this.db;
  }

  private async getFirestoreModules() {
      // @ts-ignore
      return await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
  }

  // -- Revenues --
  async getRevenues(): Promise<RevenueRecord[]> {
    const db = await this.getDb();
    const { collection, getDocs } = await this.getFirestoreModules();
    const snapshot = await getDocs(collection(db, "revenues"));
    return snapshot.docs.map((d: any) => migrateRevenueRecord(d.data()));
  }

  async saveRevenue(record: RevenueRecord): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    await setDoc(doc(db, "revenues", record.id), record, { merge: true });
  }

  async deleteRevenue(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "revenues", id));
  }

  // -- Expenses --
  async getExpenses(): Promise<ExpenseRecord[]> {
    const db = await this.getDb();
    const { collection, getDocs } = await this.getFirestoreModules();
    const snapshot = await getDocs(collection(db, "expenses"));
    return snapshot.docs.map((d: any) => migrateExpenseRecord(d.data()));
  }

  async saveExpense(record: ExpenseRecord): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    await setDoc(doc(db, "expenses", record.id), record, { merge: true });
  }

  async deleteExpense(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "expenses", id));
  }
}

let repository: IFinanceRepository;
if (DB_PROVIDER === 'firebase') {
  repository = new FirebaseFinanceAdapter();
} else {
  repository = new LocalStorageFinanceAdapter();
}
export const revenueService = repository;