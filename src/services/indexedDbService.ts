import { openDB, IDBPDatabase } from 'idb';
import type {
  Account,
  Category,
  FinancialSnapshot,
  Goal,
  Insight,
  MonthlyIncome,
  PlannedExpenseItem,
  RecurringExpense,
  Transaction,
  WealthAcceleratorMetrics
} from '../types';
import { normaliseBudgetMonths, normaliseSnapshot } from '../utils/snapshotMerge';

const DB_NAME = 'wealth-accelerator-db';
const DB_VERSION = 5;
const SNAPSHOT_STORE = 'snapshots';

const LEGACY_STORES = [
  'accounts',
  'categories',
  'transactions',
  'monthlyIncomes',
  'plannedExpenses',
  'recurringExpenses',
  'goals',
  'insights',
  'wealthMetrics',
  'connections'
] as const;

interface SnapshotRecord {
  id: 'singleton';
  payload: string;
}

type LegacyStoreName = (typeof LEGACY_STORES)[number];

let dbPromise: Promise<IDBPDatabase> | null = null;

export async function resetIndexedDbConnectionForTests() {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch (error) {
      // ignore errors during cleanup in tests
    }
  }
  dbPromise = null;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
          database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

async function clearLegacyStores() {
  const db = await getDb();
  await Promise.all(
    LEGACY_STORES.map(async (storeName) => {
      if (!db.objectStoreNames.contains(storeName)) return;
      const tx = db.transaction(storeName, 'readwrite');
      await tx.store.clear();
      await tx.done;
    })
  );
}

export async function persistSnapshot(snapshot: FinancialSnapshot) {
  const db = await getDb();
  const normalised = normaliseSnapshot(snapshot);
  const encrypted = await encryptData(JSON.stringify(normalised));
  const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
  const record: SnapshotRecord = { id: 'singleton', payload: encrypted };
  await tx.store.put(record);
  await tx.done;
  await clearLegacyStores();
}

export async function loadSnapshot(): Promise<FinancialSnapshot | null> {
  const db = await getDb();
  if (db.objectStoreNames.contains(SNAPSHOT_STORE)) {
    const record = (await db.get(SNAPSHOT_STORE, 'singleton')) as SnapshotRecord | undefined;
    if (record?.payload) {
      const decrypted = await decryptData(record.payload);
      return normaliseSnapshot(JSON.parse(decrypted) as Partial<FinancialSnapshot>);
    }
  }

  const legacySnapshot = await loadLegacySnapshot();
  if (legacySnapshot) {
    const normalised = normaliseSnapshot(legacySnapshot);
    await persistSnapshot(normalised);
    return normalised;
  }

  return null;
}

async function getAll<T>(storeName: LegacyStoreName): Promise<T[]> {
  const db = await getDb();
  if (!db.objectStoreNames.contains(storeName)) return [];
  return (await db.getAll(storeName)) as T[];
}

async function loadLegacySnapshot(): Promise<Partial<FinancialSnapshot> | null> {
  const [
    accounts,
    categories,
    transactions,
    monthlyIncomes,
    plannedExpenses,
    recurringExpenses,
    goals,
    insights,
    wealthMetrics
  ] = await Promise.all([
    getAll<Account>('accounts'),
    getAll<Category>('categories'),
    getAll<Transaction>('transactions'),
    getAll<MonthlyIncome>('monthlyIncomes'),
    getAll<PlannedExpenseItem>('plannedExpenses'),
    getAll<RecurringExpense>('recurringExpenses'),
    getAll<Goal>('goals'),
    getAll<Insight>('insights'),
    getAll<WealthAcceleratorMetrics & { id: string }>('wealthMetrics')
  ]);

  if (
    accounts.length === 0 &&
    categories.length === 0 &&
    transactions.length === 0 &&
    monthlyIncomes.length === 0 &&
    plannedExpenses.length === 0 &&
    recurringExpenses.length === 0 &&
    goals.length === 0 &&
    insights.length === 0 &&
    wealthMetrics.length === 0
  ) {
    return null;
  }

  const now = new Date().toISOString();
  const baseCurrency = accounts.find((account) => account.currency)?.currency ?? 'INR';
  const budgetMonths = normaliseBudgetMonths(undefined, plannedExpenses, baseCurrency, now);

  const metrics = wealthMetrics[0];
  return {
    profile: null,
    accounts,
    categories,
    transactions,
    monthlyIncomes,
    plannedExpenses,
    budgetMonths,
    recurringExpenses,
    goals,
    insights,
    wealthMetrics: metrics
      ? {
          capitalEfficiencyScore: metrics.capitalEfficiencyScore,
          opportunityCostAlerts: metrics.opportunityCostAlerts,
          insuranceGapAnalysis: metrics.insuranceGapAnalysis,
          updatedAt: now
        }
      : undefined,
    smartExportRules: [],
    exportHistory: [],
    revision: 0,
    lastLocalChangeAt: now
  } satisfies Partial<FinancialSnapshot>;
}

export async function exportSnapshot(): Promise<Blob> {
  const snapshot = await loadSnapshot();
  const payload = normaliseSnapshot(snapshot ?? null);
  const encrypted = await encryptData(JSON.stringify(payload));
  return new Blob([encrypted], { type: 'application/json' });
}

export async function exportSnapshotAsCsv(): Promise<Blob> {
  const snapshot = normaliseSnapshot(await loadSnapshot());
  const baseCurrency = snapshot.profile?.currency ?? 'INR';

  const rows: string[] = [];
  const pushRow = (columns: Array<string | number | undefined>) => {
    const normalisedColumns = columns.map((value) => {
      if (value === undefined || value === null) return '';
      const str = String(value).replace(/"/g, '""');
      return `"${str}` + '"';
    });
    rows.push(normalisedColumns.join(','));
  };

  pushRow(['section', 'id', 'name', 'type', 'amount', 'currency', 'date', 'metadata']);
  pushRow([
    'profile',
    'profile',
    snapshot.profile ? snapshot.profile.financialStartDate : 'not-initialised',
    snapshot.profile ? snapshot.profile.currency : '',
    '',
    snapshot.profile ? snapshot.profile.currency : '',
    snapshot.profile ? snapshot.profile.updatedAt : '',
    snapshot.profile?.openingBalanceNote
  ]);
  snapshot.accounts.forEach((account) => {
    pushRow([
      'account',
      account.id,
      account.name,
      account.type,
      account.balance,
      account.currency,
      account.updatedAt,
      account.notes
    ]);
  });
  snapshot.transactions.forEach((transaction) => {
    pushRow([
      'transaction',
      transaction.id,
      transaction.description,
      transaction.categoryId ?? 'uncategorised',
      transaction.amount,
      transaction.currency,
      transaction.date,
      transaction.accountId
    ]);
  });
  snapshot.monthlyIncomes.forEach((income) => {
    pushRow([
      'monthly-income',
      income.id,
      income.source,
      income.categoryId,
      income.amount,
      baseCurrency,
      income.receivedOn,
      income.notes
    ]);
  });
  snapshot.recurringExpenses.forEach((expense) => {
    pushRow([
      'recurring-expense',
      expense.id,
      expense.name,
      expense.categoryId,
      expense.amount,
      expense.currency,
      expense.dueDate,
      expense.frequency
    ]);
  });
  snapshot.goals.forEach((goal) => {
    pushRow([
      'goal',
      goal.id,
      goal.name,
      goal.categoryId,
      goal.targetAmount,
      baseCurrency,
      goal.targetDate,
      goal.currentAmount
    ]);
  });

  return new Blob([rows.join('\n')], { type: 'text/csv' });
}

const ENCRYPTION_KEY = 'wealth-accelerator-local-key';

async function getCryptoKey() {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data: string) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const buffer = new Uint8Array(iv.length + cipher.byteLength);
  buffer.set(iv, 0);
  buffer.set(new Uint8Array(cipher), iv.length);
  return JSON.stringify(Array.from(buffer));
}

export async function decryptData(payload: string) {
  const key = await getCryptoKey();
  const bytes = new Uint8Array(JSON.parse(payload));
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

export async function importSnapshot(blob: Blob) {
  const text = await blob.text();
  const decrypted = await decryptData(text);
  const snapshot = normaliseSnapshot(JSON.parse(decrypted) as Partial<FinancialSnapshot>);
  await persistSnapshot(snapshot);
  return snapshot;
}
