import { subMonths } from 'date-fns';
import type {
  Account,
  Category,
  FinancialInstitutionConnection,
  FinancialSnapshot,
  PlannedExpenseItem,
  RecurringExpense,
  Transaction,
  WealthAcceleratorMetrics,
  Insight,
  Goal
} from '../types';
import { persistSnapshot } from './indexedDbService';
import { generateInsights } from './insightsEngine';
import { simulateWealthAccelerator } from './wealthAcceleratorEngine';
import { v4 as uuid } from '../utils/uuid';

interface AggregationOptions {
  manualAccounts?: Account[];
  manualTransactions?: Transaction[];
  manualCategories?: Category[];
}

export class DataAggregationService {
  async aggregate(options: AggregationOptions = {}): Promise<FinancialSnapshot> {
    const [connections, accountsFromApi, transactionsFromApi, baseCategories] = await Promise.all([
      this.connectToInstitutions(),
      this.fetchAccounts(),
      this.fetchTransactions(),
      this.fetchCategories()
    ]);

    const categories = this.mergeCategories(baseCategories, options.manualCategories ?? []);
    const transactions = this.categorizeTransactions(
      [...transactionsFromApi, ...(options.manualTransactions ?? [])],
      categories
    );
    const accounts = [...accountsFromApi, ...(options.manualAccounts ?? [])];

    const plannedExpenses = this.generatePlannedExpenses(categories);
    const recurringExpenses = this.generateRecurringExpenses(categories);
    const goals = this.generateGoals(categories);

    const wealthMetrics = simulateWealthAccelerator(accounts, transactions, goals, recurringExpenses);
    const insights = generateInsights({ accounts, transactions, recurringExpenses, plannedExpenses, goals, categories });

    const snapshot: FinancialSnapshot = {
      accounts,
      categories,
      transactions,
      plannedExpenses,
      recurringExpenses,
      goals,
      insights,
      wealthMetrics,
      connections
    };

    await persistSnapshot(snapshot);
    return snapshot;
  }

  private async connectToInstitutions(): Promise<FinancialInstitutionConnection[]> {
    return [
      {
        id: uuid(),
        provider: 'Plaid',
        institutionName: 'HDFC Bank',
        country: 'IN',
        lastSyncedAt: new Date().toISOString(),
        status: 'connected'
      }
    ];
  }

  private async fetchAccounts(): Promise<Account[]> {
    return [
      {
        id: 'acct-hdfc-savings',
        name: 'HDFC Savings',
        type: 'bank',
        balance: 125000,
        currency: 'INR',
        institutionId: 'hdfc',
        isManual: false
      },
      {
        id: 'acct-zerodha-invest',
        name: 'Zerodha Investments',
        type: 'investment',
        balance: 850000,
        currency: 'INR',
        institutionId: 'zerodha',
        isManual: false
      }
    ];
  }

  private async fetchTransactions(): Promise<Transaction[]> {
    const now = new Date();
    return Array.from({ length: 40 }).map((_, index) => ({
      id: uuid(),
      accountId: index % 2 === 0 ? 'acct-hdfc-savings' : 'acct-zerodha-invest',
      amount: index % 3 === 0 ? -4500 : -1200,
      currency: 'INR',
      date: subMonths(now, Math.floor(index / 5)).toISOString(),
      description: index % 3 === 0 ? 'Amazon Purchase' : 'UPI Expense'
    }));
  }

  private async fetchCategories(): Promise<Category[]> {
    return [
      { id: 'cat-salary', name: 'Salary', type: 'income', isCustom: false },
      { id: 'cat-rent', name: 'Rent', type: 'expense', isCustom: false },
      { id: 'cat-groceries', name: 'Groceries', type: 'expense', isCustom: false },
      { id: 'cat-investment', name: 'Investments', type: 'asset', isCustom: false },
      { id: 'cat-loans', name: 'Loans', type: 'liability', isCustom: false }
    ];
  }

  private mergeCategories(base: Category[], custom: Category[]): Category[] {
    const map = new Map(base.map((cat) => [cat.id, cat]));
    for (const category of custom) {
      map.set(category.id, category);
    }
    return Array.from(map.values());
  }

  private categorizeTransactions(transactions: Transaction[], categories: Category[]): Transaction[] {
    return transactions.map((transaction) => {
      if (transaction.categoryId) return transaction;
      const match = this.aiCategorize(transaction, categories);
      return { ...transaction, categoryId: match?.id };
    });
  }

  private aiCategorize(transaction: Transaction, categories: Category[]): Category | undefined {
    const description = transaction.description.toLowerCase();
    if (description.includes('amazon') || description.includes('grocery')) {
      return categories.find((cat) => cat.name.toLowerCase().includes('groc'));
    }
    if (description.includes('rent')) {
      return categories.find((cat) => cat.name.toLowerCase() === 'rent');
    }
    if (description.includes('sip') || description.includes('mf')) {
      return categories.find((cat) => cat.type === 'asset');
    }
    return categories.find((cat) => cat.type === 'expense');
  }

  private generatePlannedExpenses(categories: Category[]): PlannedExpenseItem[] {
    const shoppingCategory = categories.find((cat) => cat.name.toLowerCase().includes('groc'));
    return [
      {
        id: uuid(),
        name: 'Diwali Shopping',
        plannedAmount: 30000,
        categoryId: shoppingCategory?.id ?? categories[0].id,
        dueDate: new Date().toISOString(),
        status: 'pending',
        notes: 'Include gifts and travel'
      }
    ];
  }

  private generateRecurringExpenses(categories: Category[]): RecurringExpense[] {
    const rentCategory = categories.find((cat) => cat.name === 'Rent');
    return [
      {
        id: uuid(),
        name: 'Home Loan EMI',
        amount: 45000,
        categoryId: rentCategory?.id ?? categories[0].id,
        frequency: 'Monthly',
        dueDate: new Date().toISOString(),
        currency: 'INR',
        isEstimated: false,
        nextDueDate: new Date().toISOString()
      }
    ];
  }

  private generateGoals(categories: Category[]): Goal[] {
    const vacationCategory = categories.find((cat) => cat.name.includes('Invest')) ?? {
      id: 'cat-vacation',
      name: 'Vacation Fund',
      type: 'asset',
      isCustom: true
    };
    return [
      {
        id: uuid(),
        name: 'Maldives Vacation',
        targetAmount: 250000,
        currentAmount: 80000,
        targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
        categoryId: vacationCategory.id
      }
    ];
  }
}

export const dataAggregationService = new DataAggregationService();
