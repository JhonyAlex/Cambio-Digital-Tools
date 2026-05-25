
export type FileType = 'audio' | 'image' | 'document' | 'text';

export interface AudioFile {
  id: string;
  file?: File; // Optional because it won't persist in LocalStorage
  name: string;
  date: Date;
  sequence: number; // WhatsApp sequence number (WAxxxx)
  status: 'pending' | 'processing' | 'completed' | 'error';
  transcript?: string; // Serves as the main "Content" or "OCR Text"
  summary?: string; // Serves as "Analysis" or "Description"
  speaker?: string;
  errorMsg?: string;
  sessionId?: string;
  fileType: FileType; // New field to distinguish content type
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ProjectSettings {
  autoSummarize: boolean;
  language: string;
  exportFormat: 'json' | 'md' | 'txt';
}

export interface Session {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: AudioFile[];
  globalSummary?: string;
  chatHistory: ChatMessage[];
  // New fields for Version 2 Migration
  tags?: string[];
  settings?: ProjectSettings;
  schemaVersion?: number;
  // New fields for Version 3 Migration
  sessions?: Session[];
}

export interface ProcessingStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

export interface TimelineGroup {
  dateStr: string; // YYYY-MM-DD
  dateObj: Date;
  items: AudioFile[];
}

export type ApiProvider = 'gemini' | 'openai';

// NEW: Granular Model Configuration
export interface ModelStrategy {
    fast: string;    // e.g., gemini-2.5-flash, gpt-4o-mini
    complex: string; // e.g., gemini-2.5-pro, gpt-4o
}

export interface ApiConfig {
  provider: ApiProvider;
  apiKey: string;
  baseUrl?: string; // For OpenRouter or custom proxies
  models: ModelStrategy; // Changed from single 'model' string
}

export interface SummaryOptions {
  focus: 'general' | 'action_items' | 'decisions' | 'sentiment' | 'maintenance_report';
  format: 'markdown' | 'bullet_points' | 'email';
  length: 'concise' | 'detailed';
  /** Solo cuando focus === 'maintenance_report' */
  periodType?: 'semanal' | 'mensual';
}

// --- PAYROLL TYPES ---

// Changed from union type to string to support dynamic roles
export type EmployeeRole = string; 

export interface RoleDefinition {
    id: string;
    name: string;
    multiplier: number;
}

export interface PayrollConfig {
  baseSalary: number; // e.g. 1423500
  totalBudget: number;
  euroExchangeRate: number;
  usdExchangeRate: number; // NEW: USD Support
  // Replaced static roleMultipliers with dynamic array
  roles: RoleDefinition[];
  // Global guidelines for Budget Terms & Conditions generation
  termsGuidelines?: string;
}

export interface Employee {
  id: string;
  fullName: string;
  role: EmployeeRole;
  bonus: number; // Free edition bonus
  active: boolean;
  joinedAt: number;
}

export interface PaymentSource {
    walletId: string;
    amount: number;
}

export interface PaymentBreakdown {
    baseSalary: number;
    christmasBonus: number; // Prima
    extraBonus: number; // Bono
}

export interface PaymentRecord {
  id: string;
  date: number;
  employeeId: string;
  employeeName: string;
  role: EmployeeRole;
  baseSalary: number;
  roleMultiplier: number;
  calculatedSalary: number;
  
  // Detailed values for historical accuracy
  christmasBonus: number;
  extraBonus: number;
  
  totalPaid: number;
  notes?: string;
  
  // Legacy field (keep for backward compatibility)
  sourceWalletId?: string; 
  
  // New fields for Split Payments & Detailed Breakdown
  fundSources?: PaymentSource[];
  breakdown?: PaymentBreakdown;
  
  // Link to Expense Record for Sync Deletion
  linkedExpenseId?: string;
  
  createdBy?: string; // NEW: Audit trail
}

export interface PayslipData {
  employee: Employee;
  salaryDetails: {
    base: number;
    total: number;
    christmas: number;
  };
  pendingBalance?: number;
  message?: string;
  tasks?: string;
  goals?: string;
  month: string;
}

// --- REVENUE & EXPENSE TYPES ---

export type RevenueStatus = 'paid' | 'pending' | 'process';

export interface RevenueRecord {
  id: string;
  clientName: string;
  amount: number; // In COP
  status: RevenueStatus;
  employeeId: string; // Linked to Employee.id
  estimatedDate: number; // Timestamp
  description?: string;
  createdAt: number;
  targetWalletId?: string; // New: Where the money went
  createdBy?: string; // NEW: Audit trail
}

export type ExpenseCategory = 'rent' | 'software' | 'services' | 'marketing' | 'other';

export interface ExpenseRecord {
  id: string;
  title: string;
  amount: number; // In COP
  category: ExpenseCategory;
  date: number;
  description?: string;
  sourceWalletId?: string; // From which account it was paid
  createdBy?: string; // NEW: Audit trail
}

// --- BUDGET & CATALOG TYPES (NEW) ---

export type CurrencyCode = 'COP' | 'USD' | 'EUR';

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  unitCost: number; 
  unitPrice: number; 
  currency: CurrencyCode; // NEW: The currency of the stored price
  category: string;
}

// NEW: Global Company Data for Budgets
export interface BudgetGlobalConfig {
    companyName: string;
    companyNit: string;
    companyAddress: string;
    companyCity: string; // NEW: Explicit City field
    companyPhone: string;
    companyEmail: string;
    companyWeb?: string;
    defaultTerms: string; // Instructions for AI or Default Text
}

export type BudgetStatus = 'draft' | 'sent' | 'accepted' | 'rejected';
export type DocumentType = 'proposal' | 'budget' | 'receivable' | 'invoice'; // NEW

export interface BudgetLineItem {
  id: string;
  catalogItemId?: string; // Link to catalog if applicable
  name: string; // Copied name to preserve history
  quantity: number;
  unitCost: number; // Original Value
  unitPrice: number; // Original Value
  currency: CurrencyCode; // NEW: Original currency of this item
}

export interface Budget {
  id: string;
  projectName?: string; // NEW: Identifiable name for the project/budget
  clientName: string;
  clientNit?: string; // NEW: Tax ID
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string; // NEW
  clientCity?: string; // NEW
  createdBy?: string; // NEW: Name of user who created it
  date: number;
  validUntil: number;
  status: BudgetStatus;
  documentType?: DocumentType; // NEW: Lifecycle stage
  items: BudgetLineItem[];
  presentationCurrency: CurrencyCode; // NEW: How to display the final total
  taxRate: number; // e.g., 0.19 for 19%
  discount: number; // Monetary amount in presentation currency
  notes?: string;
  customTermsInstruction?: string; // NEW: Persisted AI Prompt Instructions
  createdAt: number;
  updatedAt: number;
}

// --- WALLET / TREASURY TYPES ---

export type CurrencyType = 'COP' | 'EUR';
export type AccountType = 'bank' | 'cash' | 'wallet' | 'other';

export interface WalletAccount {
  id: string;
  name: string; // e.g. "Bancolombia Ahorros", "Caja Menor"
  type: AccountType;
  currency: CurrencyType;
  balance: number;
  updatedAt: number;
}

// --- AUTHENTICATION & PERMISSIONS TYPES ---

export type UserRole = 'admin' | 'user' | 'pending';

export interface AppPermissions {
    canAccessChronos: boolean;
    canAccessPayroll: boolean; // Usually restricted to Admin
    canAccessRevenue: boolean;
    canAccessWallet: boolean;
    canAccessBudgets: boolean; // New Permission
    canAccessPolisher: boolean; // NEW: Tool available to everyone
    canAccessMeetings: boolean; // NEW: Meeting Analyst
}

export interface UserProfile {
    uid: string;
    email: string;
    displayName?: string;
    role: UserRole;
    permissions: AppPermissions;
    createdAt: number;
}

// --- POLISHER (REDACTOR) TYPES ---
export interface PolisherRecord {
    id: string;
    userId: string;
    originalText: string;
    polishedContent: string;
    createdAt: number;
    hasAttachments: boolean;
}

// --- MEETING ANALYST TYPES (NEW) ---

export interface MeetingTask {
    id: string;
    description: string;
    type: 'operational' | 'technical' | 'administrative' | 'follow_up';
    status: 'pending' | 'in_progress' | 'done';
    assignee?: string;
    dueDate?: string; // YYYY-MM-DD inferred
}

export interface MeetingChapter {
    title: string;
    startTime?: string;
    summary: string;
}

export interface MeetingAnalysis {
    id: string;
    userId: string;
    originalTranscript: string;
    meta: {
        title: string;
        type: string;
        team: string;
        date: string;
        client?: string; // NEW: Automatic grouping
    };
    summary: {
        executive: string;
        decisions: string[];
        problems: string[];
        proposals: string[];
    };
    chapters: MeetingChapter[];
    questions: { question: string; answer: string }[];
    tasks: MeetingTask[];
    metrics: {
        sentiment: 'positive' | 'neutral' | 'negative';
        participationScore: number; // 0-100
        qualityScore: number; // 0-100
    };
    userNotes?: string;
    createdAt: number;
}

// --- CONTEXT TYPE (Moved from App.tsx to avoid circular dependency) ---
export interface AppContextType {
  apiConfig: ApiConfig;
  t: any; // Using 'any' to avoid circular dependency with translations.ts
}
