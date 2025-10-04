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
  WealthAcceleratorMetrics,
  FinancialInstitutionConnection
} from '../types';

const DB_NAME = 'wealth-accelerator-db';
const DB_VERSION = 3;
const SNAPSHOT_STORE = 'snapshots';

export type StoreName =
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'monthlyIncomes'
  | 'plannedExpenses'
  | 'recurringExpenses'
  | 'goals'
  | 'insights'
  | 'wealthMetrics'
  | 'connections';

type SnapshotRecord = {
  id: 'singleton';
  payload: string;
};

const LEGACY_STORES: StoreName[] = [
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
];

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('accounts')) {
          database.createObjectStore('accounts', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('categories')) {
          database.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('transactions')) {
          database.createObjectStore('transactions', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('monthlyIncomes')) {
          database.createObjectStore('monthlyIncomes', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('plannedExpenses')) {
          database.createObjectStore('plannedExpenses', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('recurringExpenses')) {
          database.createObjectStore('recurringExpenses', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('goals')) {
          database.createObjectStore('goals', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('insights')) {
          database.createObjectStore('insights', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('wealthMetrics')) {
          database.createObjectStore('wealthMetrics', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('connections')) {
          database.createObjectStore('connections', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
          database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await getDb();
  if (!db.objectStoreNames.contains(storeName)) return [];
  return db.getAll(storeName) as Promise<T[]>;
}

async function clearStore(storeName: StoreName) {
  const db = await getDb();
  if (!db.objectStoreNames.contains(storeName)) return;
  const tx = db.transaction(storeName, 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function persistSnapshot(snapshot: FinancialSnapshot) {
  const db = await getDb();
  const encrypted = await encryptData(JSON.stringify(snapshot));
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
      return JSON.parse(decrypted) as FinancialSnapshot;
    }
  }

  const legacySnapshot = await loadLegacySnapshot();
  if (legacySnapshot) {
    await persistSnapshot(legacySnapshot);
    return legacySnapshot;
  }

  return null;
}

async function loadLegacySnapshot(): Promise<FinancialSnapshot | null> {
  const [
    accounts,
    categories,
    transactions,
    monthlyIncomes,
    plannedExpenses,
    recurringExpenses,
    goals,
    insights,
    wealthMetrics,
    connections
  ] = await Promise.all([
    getAll<Account>('accounts'),
    getAll<Category>('categories'),
    getAll<Transaction>('transactions'),
    getAll<MonthlyIncome>('monthlyIncomes'),
    getAll<PlannedExpenseItem>('plannedExpenses'),
    getAll<RecurringExpense>('recurringExpenses'),
    getAll<Goal>('goals'),
    getAll<Insight>('insights'),
    getAll<WealthAcceleratorMetrics & { id: string }>('wealthMetrics'),
    getAll<FinancialInstitutionConnection>('connections')
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
    wealthMetrics.length === 0 &&
    connections.length === 0
  ) {
    return null;
  }

  const metrics = wealthMetrics[0] ?? {
    id: 'singleton',
    capitalEfficiencyScore: 0,
    opportunityCostAlerts: [],
    insuranceGapAnalysis: ''
  };

  return {
    accounts,
    categories,
    transactions,
    monthlyIncomes,
    plannedExpenses,
    recurringExpenses,
    goals,
    insights,
    wealthMetrics: {
      capitalEfficiencyScore: metrics.capitalEfficiencyScore,
      opportunityCostAlerts: metrics.opportunityCostAlerts,
      insuranceGapAnalysis: metrics.insuranceGapAnalysis
    },
    connections
};
}

export async function exportSnapshot(): Promise<Blob> {
  const snapshot = await loadSnapshot();
  const payload = snapshot ?? {
    accounts: [],
    categories: [],
    transactions: [],
    monthlyIncomes: [],
    plannedExpenses: [],
    recurringExpenses: [],
    goals: [],
    insights: [],
    wealthMetrics: {
      capitalEfficiencyScore: 0,
      opportunityCostAlerts: [],
      insuranceGapAnalysis: ''
    },
    connections: []
  };
  const encrypted = await encryptData(JSON.stringify(payload));
  return new Blob([encrypted], { type: 'application/json' });
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

async function encryptData(data: string) {
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
  const snapshot = JSON.parse(decrypted) as FinancialSnapshot;
  await persistSnapshot(snapshot);
  return snapshot;
}

async function clearLegacyStores() {
  await Promise.all(LEGACY_STORES.map((store) => clearStore(store)));
}
