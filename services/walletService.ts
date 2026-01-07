
import { WalletAccount } from '../types';
import { DB_PROVIDER, FIREBASE_CONFIG, validateConnectivity } from './config';

export interface IWalletRepository {
  getAccounts(): Promise<WalletAccount[]>;
  saveAccount(account: WalletAccount): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  processTransaction(accountId: string, amount: number, type: 'income' | 'expense', exchangeRate?: number): Promise<void>;
}

// --- ADAPTER 1: LOCAL STORAGE ---
class LocalStorageWalletAdapter implements IWalletRepository {
  private KEY_WALLET = 'wallet_accounts';

  async getAccounts(): Promise<WalletAccount[]> {
    await validateConnectivity();
    const data = localStorage.getItem(this.KEY_WALLET);
    return data ? JSON.parse(data) : [];
  }

  async saveAccount(account: WalletAccount): Promise<void> {
    await validateConnectivity();
    const accounts = await this.getAccounts();
    const index = accounts.findIndex(a => a.id === account.id);
    if (index >= 0) {
      accounts[index] = account;
    } else {
      accounts.push(account);
    }
    localStorage.setItem(this.KEY_WALLET, JSON.stringify(accounts));
  }

  async deleteAccount(id: string): Promise<void> {
    await validateConnectivity();
    const accounts = await this.getAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    localStorage.setItem(this.KEY_WALLET, JSON.stringify(filtered));
  }

  async processTransaction(accountId: string, amountCOP: number, type: 'income' | 'expense', exchangeRate: number = 4200): Promise<void> {
      await validateConnectivity();
      const accounts = await this.getAccounts();
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) throw new Error("Cuenta no encontrada");

      // Validate Amount is Number
      const safeAmount = Number(amountCOP);
      if (isNaN(safeAmount)) throw new Error("Monto inválido para transacción");

      // Convert amount based on account currency
      let finalAmount = safeAmount;
      if (account.currency === 'EUR') {
          finalAmount = safeAmount / exchangeRate;
      }

      if (type === 'income') {
          account.balance += finalAmount;
      } else {
          account.balance -= finalAmount;
      }
      account.updatedAt = Date.now();

      await this.saveAccount(account);
  }
}

// --- ADAPTER 2: FIREBASE ---
class FirebaseWalletAdapter implements IWalletRepository {
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
        console.error("Failed to load Firebase for Wallet", e);
    }
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

  async getAccounts(): Promise<WalletAccount[]> {
    const db = await this.getDb();
    const { collection, getDocs } = await this.getFirestoreModules();
    const snapshot = await getDocs(collection(db, "wallets"));
    return snapshot.docs.map((d: any) => d.data());
  }

  async saveAccount(account: WalletAccount): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    await setDoc(doc(db, "wallets", account.id), account, { merge: true });
  }

  async deleteAccount(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "wallets", id));
  }

  async processTransaction(accountId: string, amountCOP: number, type: 'income' | 'expense', exchangeRate: number = 4200): Promise<void> {
    const db = await this.getDb();
    const { doc, runTransaction } = await this.getFirestoreModules();
    const walletRef = doc(db, "wallets", accountId);

    // Validate Amount is Number
    const safeAmount = Number(amountCOP);
    if (isNaN(safeAmount)) throw new Error("Monto inválido para transacción");

    await runTransaction(db, async (transaction: any) => {
        const sfDoc = await transaction.get(walletRef);
        if (!sfDoc.exists()) throw "Account does not exist!";

        const account = sfDoc.data() as WalletAccount;
        let finalAmount = safeAmount;
        if (account.currency === 'EUR') {
            finalAmount = safeAmount / exchangeRate;
        }

        const newBalance = type === 'income' 
            ? account.balance + finalAmount 
            : account.balance - finalAmount;

        transaction.update(walletRef, { balance: newBalance, updatedAt: Date.now() });
    });
  }
}

let repository: IWalletRepository;
if (DB_PROVIDER === 'firebase') {
  repository = new FirebaseWalletAdapter();
} else {
  repository = new LocalStorageWalletAdapter();
}
export const walletService = repository;
