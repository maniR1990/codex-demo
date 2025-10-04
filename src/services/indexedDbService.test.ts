import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { webcrypto } from 'node:crypto';
import type { FinancialSnapshot } from '../types';
import { decryptData, loadSnapshot, persistSnapshot } from './indexedDbService';

const DB_NAME = 'wealth-accelerator-db';

const baseSnapshot: FinancialSnapshot = {
  accounts: [
    {
      id: 'acct-1',
      name: 'Checking',
      balance: 50000,
      type: 'bank',
      institution: 'Sample Bank',
      lastUpdated: new Date().toISOString(),
      isManual: true
    }
  ],
  categories: [
    { id: 'cat-1', name: 'Salary', type: 'income', isCustom: true },
    { id: 'cat-2', name: 'Rent', type: 'expense', isCustom: true }
  ],
  transactions: [
    {
      id: 'txn-1',
      accountId: 'acct-1',
      amount: 50000,
      date: new Date().toISOString(),
      description: 'Monthly salary',
      categoryId: 'cat-1',
      isAiCategorised: true
    }
  ],
  plannedExpenses: [],
  recurringExpenses: [],
  goals: [],
  insights: [],
  wealthMetrics: {
    capitalEfficiencyScore: 80,
    opportunityCostAlerts: [],
    insuranceGapAnalysis: ''
  },
  connections: []
};

beforeEach(async () => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto as Crypto
  });
  await indexedDB.deleteDatabase(DB_NAME);
});

describe('indexedDbService encryption', () => {
  it('stores encrypted payloads in the snapshot store', async () => {
    await persistSnapshot(baseSnapshot);

    const db = await openDB(DB_NAME, 2);
    const record = await db.get('snapshots', 'singleton');

    expect(record?.payload).toBeDefined();
    expect(record?.payload).not.toContain('Checking');

    const decrypted = await decryptData(record?.payload ?? '');
    expect(JSON.parse(decrypted)).toEqual(baseSnapshot);
  });

  it('migrates legacy stores into an encrypted snapshot and clears plain text', async () => {
    const db = await openDB(DB_NAME, 2);
    await db.put('accounts', baseSnapshot.accounts[0]);
    await db.put('categories', baseSnapshot.categories[0]);
    await db.put('transactions', baseSnapshot.transactions[0]);
    await db.put('wealthMetrics', { id: 'singleton', ...baseSnapshot.wealthMetrics });

    const snapshot = await loadSnapshot();
    expect(snapshot?.accounts).toHaveLength(1);
    expect(snapshot?.accounts[0].name).toBe('Checking');

    const legacyAccounts = await db.getAll('accounts');
    expect(legacyAccounts).toHaveLength(0);

    const encryptedRecord = await db.get('snapshots', 'singleton');
    expect(encryptedRecord?.payload ?? '').not.toContain('Sample Bank');
  });
});
