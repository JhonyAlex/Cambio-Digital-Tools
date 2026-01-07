
import { Employee, PayrollConfig, PaymentRecord, EmployeeRole, RoleDefinition } from '../types';
import { DB_PROVIDER, FIREBASE_CONFIG, validateConnectivity } from './config';

// --- INTERFACE ---
export interface IPayrollRepository {
  getConfig(): Promise<PayrollConfig>;
  saveConfig(config: PayrollConfig): Promise<void>;
  
  getEmployees(): Promise<Employee[]>;
  saveEmployee(employee: Employee): Promise<void>;
  deleteEmployee(id: string): Promise<void>;
  
  getHistory(): Promise<PaymentRecord[]>;
  savePayment(record: PaymentRecord): Promise<void>;
  deletePayment(id: string): Promise<void>; // New Method
}

// --- SCHEMA MIGRATION HELPERS (DATA SAFETY LAYER) ---

const getDefaultConfig = (): PayrollConfig => ({
  baseSalary: 1423500,
  totalBudget: 50000000,
  euroExchangeRate: 4600,
  usdExchangeRate: 4200, // Added Default USD
  roles: [
      { id: '1', name: 'Auxiliar', multiplier: 1 },
      { id: '2', name: 'Senior', multiplier: 2.5 },
      { id: '3', name: 'CEO', multiplier: 5 }
  ]
});

// Inteligente: Convierte config antigua (objeto multipliers) a nueva (array roles)
const migrateConfig = (data: any): PayrollConfig => {
    const base = getDefaultConfig();
    
    // Si ya tiene el formato nuevo, usarlo
    if (data.roles && Array.isArray(data.roles)) {
        return {
            baseSalary: data.baseSalary ?? base.baseSalary,
            totalBudget: data.totalBudget ?? base.totalBudget,
            euroExchangeRate: data.euroExchangeRate ?? base.euroExchangeRate,
            usdExchangeRate: data.usdExchangeRate ?? base.usdExchangeRate,
            roles: data.roles
        };
    }

    // Si tiene el formato antiguo (roleMultipliers), migrarlo
    if (data.roleMultipliers) {
        const migratedRoles: RoleDefinition[] = [];
        let idCounter = 1;
        for (const [key, value] of Object.entries(data.roleMultipliers)) {
            migratedRoles.push({
                id: String(idCounter++),
                name: key,
                multiplier: Number(value)
            });
        }
        return {
            baseSalary: data.baseSalary ?? base.baseSalary,
            totalBudget: data.totalBudget ?? base.totalBudget,
            euroExchangeRate: data.euroExchangeRate ?? base.euroExchangeRate,
            usdExchangeRate: base.usdExchangeRate,
            roles: migratedRoles.length > 0 ? migratedRoles : base.roles
        };
    }

    return base;
};

const migrateEmployee = (data: any): Employee => {
  return {
    id: data.id || crypto.randomUUID(),
    fullName: data.fullName || 'Empleado Sin Nombre',
    role: data.role || 'Auxiliar',
    bonus: typeof data.bonus === 'number' ? data.bonus : 0,
    active: typeof data.active === 'boolean' ? data.active : true, // Default to true
    joinedAt: data.joinedAt || Date.now()
  };
};

const migratePaymentRecord = (data: any): PaymentRecord => {
    return {
        id: data.id || crypto.randomUUID(),
        date: data.date || Date.now(),
        employeeId: data.employeeId || 'unknown',
        employeeName: data.employeeName || 'Desconocido',
        role: data.role || 'Auxiliar',
        baseSalary: data.baseSalary || 0,
        roleMultiplier: data.roleMultiplier || 1,
        calculatedSalary: data.calculatedSalary || 0,
        christmasBonus: data.christmasBonus || 0,
        extraBonus: data.extraBonus || 0,
        totalPaid: data.totalPaid || 0,
        notes: data.notes || '',
        sourceWalletId: data.sourceWalletId,
        fundSources: data.fundSources,
        breakdown: data.breakdown,
        linkedExpenseId: data.linkedExpenseId // Persist link
    };
};


// --- ADAPTER 1: LOCAL STORAGE ---
class LocalStorageAdapter implements IPayrollRepository {
  private KEY_CONFIG = 'payroll_config';
  private KEY_EMPLOYEES = 'payroll_employees';
  private KEY_HISTORY = 'payroll_history';

  async getConfig(): Promise<PayrollConfig> {
    await validateConnectivity();
    const data = localStorage.getItem(this.KEY_CONFIG);
    if (data) {
        const parsed = JSON.parse(data);
        return migrateConfig(parsed);
    }
    return getDefaultConfig();
  }

  async saveConfig(config: PayrollConfig): Promise<void> {
    await validateConnectivity();
    localStorage.setItem(this.KEY_CONFIG, JSON.stringify(config));
  }

  async getEmployees(): Promise<Employee[]> {
    await validateConnectivity();
    const data = localStorage.getItem(this.KEY_EMPLOYEES);
    const raw = data ? JSON.parse(data) : [];
    return raw.map(migrateEmployee);
  }

  async saveEmployee(employee: Employee): Promise<void> {
    await validateConnectivity();
    const employees = await this.getEmployees();
    const index = employees.findIndex(e => e.id === employee.id);
    if (index >= 0) {
      employees[index] = employee;
    } else {
      employees.push(employee);
    }
    localStorage.setItem(this.KEY_EMPLOYEES, JSON.stringify(employees));
  }

  async deleteEmployee(id: string): Promise<void> {
    await validateConnectivity();
    const employees = await this.getEmployees();
    const filtered = employees.filter(e => e.id !== id);
    localStorage.setItem(this.KEY_EMPLOYEES, JSON.stringify(filtered));
  }

  async getHistory(): Promise<PaymentRecord[]> {
    await validateConnectivity();
    const data = localStorage.getItem(this.KEY_HISTORY);
    const raw = data ? JSON.parse(data) : [];
    return raw.map(migratePaymentRecord);
  }

  async savePayment(record: PaymentRecord): Promise<void> {
    await validateConnectivity();
    const history = await this.getHistory();
    const index = history.findIndex(r => r.id === record.id);
    
    if (index >= 0) {
        // Update existing
        history[index] = record;
    } else {
        // Create new
        history.push(record);
    }
    localStorage.setItem(this.KEY_HISTORY, JSON.stringify(history));
  }

  async deletePayment(id: string): Promise<void> {
      await validateConnectivity();
      const history = await this.getHistory();
      const filtered = history.filter(r => r.id !== id);
      localStorage.setItem(this.KEY_HISTORY, JSON.stringify(filtered));
  }
}

// --- ADAPTER 2: FIREBASE (GOOGLE CLOUD) ---
class FirebaseAdapter implements IPayrollRepository {
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
        console.error("Firebase Init Error", e);
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

  async getConfig(): Promise<PayrollConfig> {
    const db = await this.getDb();
    const { doc, getDoc } = await this.getFirestoreModules();
    const docRef = doc(db, "payroll", "config");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const data = snap.data();
        return migrateConfig(data);
    }
    return getDefaultConfig();
  }

  async saveConfig(config: PayrollConfig): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    await setDoc(doc(db, "payroll", "config"), config);
  }

  async getEmployees(): Promise<Employee[]> {
    const db = await this.getDb();
    const { collection, getDocs } = await this.getFirestoreModules();
    const snapshot = await getDocs(collection(db, "employees"));
    const raw = snapshot.docs.map((d: any) => d.data());
    return raw.map(migrateEmployee);
  }

  async saveEmployee(employee: Employee): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    await setDoc(doc(db, "employees", employee.id), employee, { merge: true });
  }

  async deleteEmployee(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "employees", id));
  }

  async getHistory(): Promise<PaymentRecord[]> {
    const db = await this.getDb();
    const { collection, getDocs } = await this.getFirestoreModules();
    const snapshot = await getDocs(collection(db, "history"));
    const raw = snapshot.docs.map((d: any) => d.data());
    return raw.map(migratePaymentRecord);
  }

  async savePayment(record: PaymentRecord): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    // Use ID to support updates (upsert)
    await setDoc(doc(db, "history", record.id), record, { merge: true });
  }

  async deletePayment(id: string): Promise<void> {
      const db = await this.getDb();
      const { doc, deleteDoc } = await this.getFirestoreModules();
      await deleteDoc(doc(db, "history", id));
  }
}

let repository: IPayrollRepository;
if (DB_PROVIDER === 'firebase') {
  repository = new FirebaseAdapter();
} else {
  repository = new LocalStorageAdapter();
}
export const payrollService = repository;
