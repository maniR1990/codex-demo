export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'SGD';

export type Frequency = 'Monthly' | 'Quarterly' | 'Annually' | 'Weekly' | 'Daily';

export interface FinancialInstitutionConnection {
  id: string;
  provider: 'Plaid' | 'Yodlee';
  institutionName: string;
  country: 'IN' | 'US' | 'UK' | 'SG';
  lastSyncedAt?: string;
  status: 'connected' | 'error' | 'pending';
}

export interface Account {
  id: string;
  name: string;
  type: 'bank' | 'investment' | 'loan' | 'credit-card' | 'cash' | 'real-estate' | 'other';
  balance: number;
  currency: Currency;
  institutionId?: string;
  isManual: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'asset' | 'liability';
  isCustom: boolean;
  parentId?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currency: Currency;
  date: string;
  description: string;
  categoryId?: string;
  isRecurringMatch?: boolean;
  isPlannedMatch?: boolean;
}

export interface PlannedExpenseItem {
  id: string;
  name: string;
  plannedAmount: number;
  categoryId: string;
  dueDate: string;
  status: 'pending' | 'purchased' | 'cancelled' | 'reconciled';
  notes?: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  frequency: Frequency;
  dueDate: string;
  currency: Currency;
  isEstimated: boolean;
  nextDueDate?: string;
}

export interface MonthlyIncome {
  id: string;
  source: string;
  amount: number;
  categoryId: string;
  receivedOn: string;
  notes?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  categoryId: string;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface WealthAcceleratorMetrics {
  capitalEfficiencyScore: number; // 0-100
  opportunityCostAlerts: string[];
  insuranceGapAnalysis: string;
}

export interface FinancialSnapshot {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  monthlyIncomes: MonthlyIncome[];
  plannedExpenses: PlannedExpenseItem[];
  recurringExpenses: RecurringExpense[];
  goals: Goal[];
  insights: Insight[];
  wealthMetrics: WealthAcceleratorMetrics;
  connections: FinancialInstitutionConnection[];
}
