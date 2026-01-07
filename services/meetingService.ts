import { MeetingAnalysis, MeetingTask } from '../types';
import { DB_PROVIDER, FIREBASE_CONFIG, validateConnectivity } from './config';

export interface IMeetingRepository {
  getHistory(userId: string): Promise<MeetingAnalysis[]>;
  saveAnalysis(analysis: MeetingAnalysis): Promise<void>;
  deleteAnalysis(id: string): Promise<void>;
  updateTaskStatus(analysisId: string, taskId: string, status: MeetingTask['status']): Promise<void>;
  updateUserNotes(analysisId: string, notes: string): Promise<void>;
  updateAnalysisMeta(analysisId: string, updates: Partial<MeetingAnalysis['meta']>): Promise<void>;
}

// --- ADAPTER 1: LOCAL STORAGE ---
class LocalStorageMeetingAdapter implements IMeetingRepository {
  private KEY = 'meeting_history';

  private getAll(): MeetingAnalysis[] {
      const data = localStorage.getItem(this.KEY);
      return data ? JSON.parse(data) : [];
  }

  async getHistory(userId: string): Promise<MeetingAnalysis[]> {
    await validateConnectivity();
    const all = this.getAll();
    return all.filter(r => r.userId === userId).sort((a,b) => b.createdAt - a.createdAt);
  }

  async saveAnalysis(analysis: MeetingAnalysis): Promise<void> {
    await validateConnectivity();
    const all = this.getAll();
    const index = all.findIndex(r => r.id === analysis.id);
    if (index >= 0) all[index] = analysis;
    else all.push(analysis);
    localStorage.setItem(this.KEY, JSON.stringify(all));
  }

  async deleteAnalysis(id: string): Promise<void> {
    await validateConnectivity();
    const all = this.getAll();
    const filtered = all.filter(r => r.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(filtered));
  }

  async updateTaskStatus(analysisId: string, taskId: string, status: MeetingTask['status']): Promise<void> {
      await validateConnectivity();
      const all = this.getAll();
      const analysisIndex = all.findIndex(a => a.id === analysisId);
      if (analysisIndex >= 0) {
          const tasks = all[analysisIndex].tasks;
          const taskIndex = tasks.findIndex(t => t.id === taskId);
          if (taskIndex >= 0) {
              tasks[taskIndex].status = status;
              all[analysisIndex].tasks = tasks;
              localStorage.setItem(this.KEY, JSON.stringify(all));
          }
      }
  }

  async updateUserNotes(analysisId: string, notes: string): Promise<void> {
      await validateConnectivity();
      const all = this.getAll();
      const index = all.findIndex(a => a.id === analysisId);
      if (index >= 0) {
          all[index].userNotes = notes;
          localStorage.setItem(this.KEY, JSON.stringify(all));
      }
  }

  async updateAnalysisMeta(analysisId: string, updates: Partial<MeetingAnalysis['meta']>): Promise<void> {
      await validateConnectivity();
      const all = this.getAll();
      const index = all.findIndex(a => a.id === analysisId);
      if (index >= 0) {
          all[index].meta = { ...all[index].meta, ...updates };
          localStorage.setItem(this.KEY, JSON.stringify(all));
      }
  }
}

// --- ADAPTER 2: FIREBASE ---
class FirebaseMeetingAdapter implements IMeetingRepository {
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
    } catch (e) { console.error("Firebase Meeting Init Error", e); }
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

  async getHistory(userId: string): Promise<MeetingAnalysis[]> {
    const db = await this.getDb();
    const { collection, getDocs, query, where } = await this.getFirestoreModules();
    
    const q = query(
        collection(db, "meeting_history"), 
        where("userId", "==", userId)
    );
    
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map((d: any) => d.data() as MeetingAnalysis);
    
    return records.sort((a: MeetingAnalysis, b: MeetingAnalysis) => b.createdAt - a.createdAt);
  }

  async saveAnalysis(analysis: MeetingAnalysis): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    await setDoc(doc(db, "meeting_history", analysis.id), analysis, { merge: true });
  }

  async deleteAnalysis(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "meeting_history", id));
  }

  async updateTaskStatus(analysisId: string, taskId: string, status: MeetingTask['status']): Promise<void> {
      const db = await this.getDb();
      const { doc, getDoc, updateDoc } = await this.getFirestoreModules();
      const ref = doc(db, "meeting_history", analysisId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
          const data = snap.data() as MeetingAnalysis;
          const updatedTasks = data.tasks.map(t => t.id === taskId ? { ...t, status } : t);
          await updateDoc(ref, { tasks: updatedTasks });
      }
  }

  async updateUserNotes(analysisId: string, notes: string): Promise<void> {
      const db = await this.getDb();
      const { doc, updateDoc } = await this.getFirestoreModules();
      await updateDoc(doc(db, "meeting_history", analysisId), { userNotes: notes });
  }

  async updateAnalysisMeta(analysisId: string, updates: Partial<MeetingAnalysis['meta']>): Promise<void> {
      const db = await this.getDb();
      const { doc, updateDoc } = await this.getFirestoreModules();
      // 'meta' is a map field, we can use dot notation to update specific fields if needed, 
      // but simpler to merge just the 'meta' object if we want to replace keys.
      // Firestore updateDoc merges top level fields. For nested fields like 'meta', 
      // we need to be careful not to overwrite the whole object if we only have partials.
      // However, the interface asks for Partial<Meta>, let's fetch, merge locally and update.
      
      const ref = doc(db, "meeting_history", analysisId);
      // To perform a safe deep merge update without fetching first (optimized):
      // Construct update map: { "meta.client": "New", "meta.title": "New" }
      const updatePayload: any = {};
      for (const [key, value] of Object.entries(updates)) {
          updatePayload[`meta.${key}`] = value;
      }
      
      await updateDoc(ref, updatePayload);
  }
}

let repository: IMeetingRepository;
if (DB_PROVIDER === 'firebase') {
  repository = new FirebaseMeetingAdapter();
} else {
  repository = new LocalStorageMeetingAdapter();
}
export const meetingService = repository;