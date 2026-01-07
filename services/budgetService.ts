
import { Budget, CatalogItem, BudgetGlobalConfig } from '../types';
import { DB_PROVIDER, FIREBASE_CONFIG, validateConnectivity } from './config';

export interface IBudgetRepository {
  // Catalog
  getCatalog(): Promise<CatalogItem[]>;
  saveCatalogItem(item: CatalogItem): Promise<void>;
  deleteCatalogItem(id: string): Promise<void>;

  // Global Config
  getGlobalConfig(): Promise<BudgetGlobalConfig>;
  saveGlobalConfig(config: BudgetGlobalConfig): Promise<void>;

  // Budgets
  getBudgets(): Promise<Budget[]>;
  saveBudget(budget: Budget): Promise<void>;
  deleteBudget(id: string): Promise<void>;
  duplicateBudget(id: string): Promise<Budget>;
}

// --- HELPER: Default Global Config ---
const DEFAULT_GLOBAL_CONFIG: BudgetGlobalConfig = {
    companyName: 'Mi Empresa',
    companyNit: '',
    companyAddress: '',
    companyCity: '',
    companyPhone: '',
    companyEmail: '',
    defaultTerms: 'Pago 50% anticipo, 50% contra entrega. Validez de oferta: 15 días.'
};

// --- HELPER: Migrate Data Structure ---
const migrateBudget = (data: any): Budget => {
    return {
        id: data.id,
        projectName: data.projectName || '', // Migration default
        clientName: data.clientName || 'Cliente',
        clientNit: data.clientNit || '', // Migration default
        clientEmail: data.clientEmail || '',
        clientPhone: data.clientPhone || '',
        clientAddress: data.clientAddress || '', // Migration default
        clientCity: data.clientCity || '', // Migration default
        createdBy: data.createdBy || '', // Migration default
        date: data.date || Date.now(),
        validUntil: data.validUntil || Date.now() + 2592000000,
        status: data.status || 'draft',
        documentType: data.documentType || 'budget', // NEW: Default to budget
        items: Array.isArray(data.items) ? data.items : [],
        presentationCurrency: data.presentationCurrency || 'COP',
        taxRate: data.taxRate || 0,
        discount: data.discount || 0,
        notes: data.notes || '',
        customTermsInstruction: data.customTermsInstruction || '', // NEW
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now()
    };
};

// --- ADAPTER 1: LOCAL STORAGE ---
class LocalStorageBudgetAdapter implements IBudgetRepository {
  private KEY_CATALOG = 'budget_catalog';
  private KEY_BUDGETS = 'budget_records';
  private KEY_CONFIG = 'budget_global_config';

  // Catalog
  async getCatalog(): Promise<CatalogItem[]> {
    await validateConnectivity();
    const data = localStorage.getItem(this.KEY_CATALOG);
    return data ? JSON.parse(data) : [];
  }

  async saveCatalogItem(item: CatalogItem): Promise<void> {
    await validateConnectivity();
    const items = await this.getCatalog();
    const index = items.findIndex(i => i.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
    localStorage.setItem(this.KEY_CATALOG, JSON.stringify(items));
  }

  async deleteCatalogItem(id: string): Promise<void> {
    await validateConnectivity();
    const items = await this.getCatalog();
    const filtered = items.filter(i => i.id !== id);
    localStorage.setItem(this.KEY_CATALOG, JSON.stringify(filtered));
  }

  // Global Config
  async getGlobalConfig(): Promise<BudgetGlobalConfig> {
      await validateConnectivity();
      const data = localStorage.getItem(this.KEY_CONFIG);
      if (data) {
          const parsed = JSON.parse(data);
          return { ...DEFAULT_GLOBAL_CONFIG, ...parsed };
      }
      return DEFAULT_GLOBAL_CONFIG;
  }

  async saveGlobalConfig(config: BudgetGlobalConfig): Promise<void> {
      await validateConnectivity();
      localStorage.setItem(this.KEY_CONFIG, JSON.stringify(config));
  }

  // Budgets
  async getBudgets(): Promise<Budget[]> {
    await validateConnectivity();
    const data = localStorage.getItem(this.KEY_BUDGETS);
    const raw = data ? JSON.parse(data) : [];
    return raw.map(migrateBudget);
  }

  async saveBudget(budget: Budget): Promise<void> {
    await validateConnectivity();
    const budgets = await this.getBudgets();
    const index = budgets.findIndex(b => b.id === budget.id);
    if (index >= 0) budgets[index] = budget;
    else budgets.push(budget);
    localStorage.setItem(this.KEY_BUDGETS, JSON.stringify(budgets));
  }

  async deleteBudget(id: string): Promise<void> {
    await validateConnectivity();
    const budgets = await this.getBudgets();
    const filtered = budgets.filter(b => b.id !== id);
    localStorage.setItem(this.KEY_BUDGETS, JSON.stringify(filtered));
  }

  async duplicateBudget(id: string): Promise<Budget> {
    await validateConnectivity();
    const budgets = await this.getBudgets();
    const original = budgets.find(b => b.id === id);
    if (!original) throw new Error("Budget not found");

    const newBudget: Budget = {
      ...original,
      id: crypto.randomUUID(),
      date: Date.now(),
      status: 'draft',
      projectName: original.projectName ? `${original.projectName} (Copia)` : '',
      clientName: original.clientName, // Keep client name as is
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: original.items.map(item => ({ ...item, id: crypto.randomUUID() }))
    };

    await this.saveBudget(newBudget);
    return newBudget;
  }
}

// --- ADAPTER 2: FIREBASE ---
class FirebaseBudgetAdapter implements IBudgetRepository {
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
    } catch (e) { console.error("Firebase Budget Init Error", e); }
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

  // Catalog
  async getCatalog(): Promise<CatalogItem[]> {
    const db = await this.getDb();
    const { collection, getDocs } = await this.getFirestoreModules();
    const snapshot = await getDocs(collection(db, "budget_catalog"));
    return snapshot.docs.map((d: any) => d.data());
  }

  async saveCatalogItem(item: CatalogItem): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    await setDoc(doc(db, "budget_catalog", item.id), item, { merge: true });
  }

  async deleteCatalogItem(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "budget_catalog", id));
  }

  // Global Config
  async getGlobalConfig(): Promise<BudgetGlobalConfig> {
      const db = await this.getDb();
      const { doc, getDoc } = await this.getFirestoreModules();
      const snap = await getDoc(doc(db, "budget_config", "global"));
      if (snap.exists()) {
          return { ...DEFAULT_GLOBAL_CONFIG, ...snap.data() };
      }
      return DEFAULT_GLOBAL_CONFIG;
  }

  async saveGlobalConfig(config: BudgetGlobalConfig): Promise<void> {
      const db = await this.getDb();
      const { doc, setDoc } = await this.getFirestoreModules();
      await setDoc(doc(db, "budget_config", "global"), config, { merge: true });
  }

  // Budgets
  async getBudgets(): Promise<Budget[]> {
    const db = await this.getDb();
    const { collection, getDocs } = await this.getFirestoreModules();
    const snapshot = await getDocs(collection(db, "budgets"));
    return snapshot.docs.map((d: any) => migrateBudget(d.data()));
  }

  async saveBudget(budget: Budget): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    await setDoc(doc(db, "budgets", budget.id), budget, { merge: true });
  }

  async deleteBudget(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "budgets", id));
  }

  async duplicateBudget(id: string): Promise<Budget> {
    const db = await this.getDb();
    const { doc, getDoc, setDoc } = await this.getFirestoreModules();
    
    const snap = await getDoc(doc(db, "budgets", id));
    if (!snap.exists()) throw new Error("Budget not found");
    const original = migrateBudget(snap.data());

    const newBudget: Budget = {
      ...original,
      id: crypto.randomUUID(),
      date: Date.now(),
      status: 'draft',
      projectName: original.projectName ? `${original.projectName} (Copia)` : '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: original.items.map(item => ({ ...item, id: crypto.randomUUID() }))
    };

    await setDoc(doc(db, "budgets", newBudget.id), newBudget);
    return newBudget;
  }
}

let repository: IBudgetRepository;
if (DB_PROVIDER === 'firebase') {
  repository = new FirebaseBudgetAdapter();
} else {
  repository = new LocalStorageBudgetAdapter();
}
export const budgetService = repository;
