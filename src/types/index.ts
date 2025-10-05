export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'SGD';

export type Frequency = 'Monthly' | 'Quarterly' | 'Annually' | 'Weekly' | 'Daily';

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface Profile extends Timestamped {
  currency: Currency;
  financialStartDate: string;
  openingBalanceNote?: string;
}

export interface Account extends Timestamped {
  id: string;
  name: string;
  type: 'bank' | 'investment' | 'loan' | 'credit-card' | 'cash' | 'real-estate' | 'other';
  balance: number;
  currency: Currency;
  institutionId?: string;
  isManual: boolean;
  notes?: string;
}

export interface CategoryBudgets {
  monthly?: number;
  yearly?: number;
}

export interface Category extends Timestamped {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'asset' | 'liability';
  isCustom: boolean;
  parentId?: string;
  tags: string[];
  budgets?: CategoryBudgets;
}

export interface Transaction extends Timestamped {
  id: string;
  accountId: string;
  amount: number;
  currency: Currency;
  date: string;
  description: string;
  categoryId?: string;
  isRecurringMatch?: boolean;
  isPlannedMatch?: boolean;
  notes?: string;
}

export interface PlannedExpenseItem extends Timestamped {
  id: string;
  name: string;
  plannedAmount: number;
  actualAmount?: number;
  categoryId: string;
  dueDate?: string | null;
  priority: 'low' | 'medium' | 'high';
  remainderAmount?: number | null;
  status: 'pending' | 'purchased' | 'cancelled' | 'reconciled';
  notes?: string;
}

export interface RecurringExpense extends Timestamped {
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

export interface MonthlyIncome extends Timestamped {
  id: string;
  source: string;
  amount: number;
  categoryId: string;
  receivedOn: string;
  notes?: string;
}

export interface Goal extends Timestamped {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  categoryId: string;
}

export interface Insight extends Timestamped {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  metricSummary?: {
    label: string;
    value: string;
    helperText?: string;
  };
  recommendations?: string[];
  projection?: {
    title: string;
    description: string;
    currentValue: number;
    projectedValue: number;
    timeframe: string;
    unit: 'currency' | 'percentage';
  };
}

export interface WealthAcceleratorMetrics {
  capitalEfficiencyScore: number; // 0-100
  opportunityCostAlerts: string[];
  insuranceGapAnalysis: string;
  updatedAt: string;
}

export interface SmartExportRule extends Timestamped {
  id: string;
  name: string;
  type: 'weekly' | 'transaction-count';
  threshold: number;
  target: 'git' | 'file';
  gpgKeyFingerprint?: string;
  lastTriggeredAt?: string;
}

export interface ExportEvent extends Timestamped {
  id: string;
  ruleId?: string;
  trigger: 'manual' | 'automation';
  medium: 'file' | 'git';
  format: 'json' | 'csv' | 'git';
  context?: string;
}

export interface FirebaseSyncConfig {
  apiKey: string;
  appId: string;
  projectId: string;
  authDomain?: string;
  databaseURL?: string;
  useCustomToken?: boolean;
  customToken?: string;
}

export interface FinancialSnapshot {
  profile: Profile | null;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  monthlyIncomes: MonthlyIncome[];
  plannedExpenses: PlannedExpenseItem[];
  recurringExpenses: RecurringExpense[];
  goals: Goal[];
  insights: Insight[];
  wealthMetrics: WealthAcceleratorMetrics;
  smartExportRules: SmartExportRule[];
  exportHistory: ExportEvent[];
  revision: number;
  lastLocalChangeAt: string;
}
