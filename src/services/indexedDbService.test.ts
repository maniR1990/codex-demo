import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDB } from 'idb';
import { webcrypto } from 'node:crypto';
import type { FinancialSnapshot } from '../types';
import { decryptData, loadSnapshot, persistSnapshot } from './indexedDbService';

const DB_NAME = 'wealth-accelerator-db';
const DB_VERSION = 4;

const buildSnapshot = (timestamp: string): FinancialSnapshot => ({
  profile: {
    currency: 'INR',
    financialStartDate: '2024-01-01',
    openingBalanceNote: 'Initial import',
    createdAt: timestamp,
    updatedAt: timestamp
  },
  accounts: [
    {
      id: 'acct-1',
      name: 'Checking',
      balance: 50000,
      type: 'bank',
      currency: 'INR',
      institutionId: 'sample-bank',
      isManual: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ],
  categories: [
    { id: 'cat-1', name: 'Salary', type: 'income', isCustom: true, createdAt: timestamp, updatedAt: timestamp },
    { id: 'cat-2', name: 'Rent', type: 'expense', isCustom: true, createdAt: timestamp, updatedAt: timestamp }
  ],
  transactions: [
    {
      id: 'txn-1',
      accountId: 'acct-1',
      amount: 50000,
      currency: 'INR',
      date: timestamp,
      description: 'Monthly salary',
      categoryId: 'cat-1',
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ],
  monthlyIncomes: [
    {
      id: 'custom-income-1',
      source: 'Salary',
      amount: 50000,
      categoryId: 'cat-1',
      receivedOn: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ],
  plannedExpenses: [],
  budgetMonths: {},
  recurringExpenses: [],
  goals: [],
  insights: [
    {
      id: 'insight-1',
      title: 'Savings Rate Check',
      description: 'Sample insight',
      severity: 'info',
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ],
  wealthMetrics: {
    capitalEfficiencyScore: 80,
    opportunityCostAlerts: [],
    insuranceGapAnalysis: '',
    updatedAt: timestamp
  },
  smartExportRules: [],
  exportHistory: [],
  revision: 1,
  lastLocalChangeAt: timestamp
});

let baseSnapshot: FinancialSnapshot;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  baseSnapshot = buildSnapshot(new Date().toISOString());
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto as Crypto
  });
  await indexedDB.deleteDatabase(DB_NAME);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('indexedDbService encryption', () => {
  it('stores encrypted payloads in the snapshot store', async () => {
    await persistSnapshot(baseSnapshot);

    const db = await openDB(DB_NAME, DB_VERSION);
    const record = await db.get('snapshots', 'singleton');

    expect(record?.payload).toBeDefined();
    expect(record?.payload).not.toContain('Checking');

    const decrypted = await decryptData(record?.payload ?? '');
    expect(JSON.parse(decrypted)).toEqual(baseSnapshot);
  });

  it('migrates legacy stores into an encrypted snapshot and clears plain text', async () => {
    const db = await openDB(DB_NAME, DB_VERSION);
    await db.put('accounts', baseSnapshot.accounts[0]);
    await db.put('categories', baseSnapshot.categories[0]);
    await db.put('transactions', baseSnapshot.transactions[0]);
    await db.put('monthlyIncomes', baseSnapshot.monthlyIncomes[0]);
    await db.put('wealthMetrics', { id: 'singleton', ...baseSnapshot.wealthMetrics });

    const snapshot = await loadSnapshot();
    expect(snapshot?.accounts).toHaveLength(1);
    expect(snapshot?.accounts[0].name).toBe('Checking');
    expect(snapshot?.monthlyIncomes).toHaveLength(1);
    expect(snapshot?.profile).toBeNull();

    const legacyAccounts = await db.getAll('accounts');
    expect(legacyAccounts).toHaveLength(0);
    const legacyIncomes = await db.getAll('monthlyIncomes');
    expect(legacyIncomes).toHaveLength(0);

    const encryptedRecord = await db.get('snapshots', 'singleton');
    expect(encryptedRecord?.payload ?? '').not.toContain('Sample Bank');
  });
});
