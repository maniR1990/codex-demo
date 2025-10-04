const { crypto } = globalThis;

export function generateId(prefix = 'id') {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

export function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
}

export function formatNumber(amount) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(amount);
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

export function groupBy(array, callback) {
  const map = new Map();
  array.forEach((item) => {
    const key = callback(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

export function calculateNetWorth(accounts) {
  const assetTypes = new Set(['bank', 'investment', 'cash', 'property', 'other-asset']);
  const liabilityTypes = new Set(['loan', 'credit-card', 'other-liability']);
  const assets = sum(accounts.filter((a) => assetTypes.has(a.type)).map((a) => a.balance));
  const liabilities = sum(accounts.filter((a) => liabilityTypes.has(a.type)).map((a) => a.balance));
  return { assets, liabilities, netWorth: assets - liabilities };
}

export function sortByDateDesc(items, selector) {
  return [...items].sort((a, b) => new Date(selector(b)).getTime() - new Date(selector(a)).getTime());
}

export function ordinal(number) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = number % 100;
  return number + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatMonth(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function average(values) {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
      return () => listeners.get(event).delete(callback);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((cb) => cb(payload));
    }
  };
}

export function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

export function variance(values) {
  if (values.length < 2) return 0;
  const avg = average(values);
  return average(values.map((value) => (value - avg) ** 2));
}

export function standardDeviation(values) {
  return Math.sqrt(variance(values));
}
