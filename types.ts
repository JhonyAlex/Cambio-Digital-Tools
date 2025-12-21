
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

export interface ApiConfig {
  provider: ApiProvider;
  apiKey: string;
  model: string; // e.g., "gemini-2.5-flash" or "gpt-4o"
  baseUrl?: string; // For OpenRouter or custom proxies
}

export interface SummaryOptions {
  focus: 'general' | 'action_items' | 'decisions' | 'sentiment';
  format: 'markdown' | 'bullet_points' | 'email';
  length: 'concise' | 'detailed';
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
  // Replaced static roleMultipliers with dynamic array
  roles: RoleDefinition[];
}

export interface Employee {
  id: string;
  fullName: string;
  role: EmployeeRole;
  bonus: number; // Free edition bonus
  active: boolean;
  joinedAt: number;
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
  christmasBonus: number;
  extraBonus: number;
  totalPaid: number;
  notes?: string;
}

export interface PayslipData {
  employee: Employee;
  salaryDetails: {
    base: number;
    total: number;
    christmas: number;
  };
  message?: string;
  tasks?: string;
  goals?: string;
  month: string;
}

// --- REVENUE TYPES ---

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
}
