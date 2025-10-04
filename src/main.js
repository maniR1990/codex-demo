import { store } from './store.js';
import { renderView, viewList } from './views.js';
import { formatDate } from './utils.js';

const navElement = document.getElementById('nav');
const viewContainer = document.getElementById('view-container');
const appShell = document.getElementById('app');
const toastArea = document.getElementById('toast-container');
const connectionBanner = document.getElementById('connection-banner');
const syncIndicator = document.getElementById('sync-status');
const exportButton = document.getElementById('export-data');
const importInput = document.getElementById('import-data');
const resetButton = document.getElementById('reset-data');

let currentView = 'dashboard';
let currentState = store.getState();
let syncTimeout;

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.textContent = message;
  toastArea.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function flashSyncIndicator() {
  syncIndicator.classList.remove('hidden');
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncIndicator.classList.add('hidden');
  }, 1500);
}

function renderNav() {
  navElement.innerHTML = viewList
    .map(
      (view) => `
        <button type="button" data-view="${view.id}" class="${currentView === view.id ? 'active' : ''}">
          ${view.label}
        </button>
      `
    )
    .join('');
}

function render() {
  renderNav();
  viewContainer.innerHTML = renderView(currentView, currentState);
  appShell.dataset.view = currentView;
}

function setView(viewId) {
  currentView = viewId;
  render();
}

function parseNumber(value) {
  if (value === '' || value === undefined || value === null) return 0;
  return Number(value);
}

function handleFormSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const action = form.dataset.action;
  if (!action) return;
  event.preventDefault();

  const formData = new FormData(form);
  try {
    switch (action) {
      case 'add-account': {
        const payload = {
          name: formData.get('name')?.toString().trim() ?? 'New account',
          institution: formData.get('institution')?.toString().trim() ?? 'Manual',
          type: formData.get('type')?.toString() ?? 'bank',
          balance: parseNumber(formData.get('balance'))
        };
        store.addAccount(payload);
        form.reset();
        showToast('Account added successfully');
        break;
      }
      case 'add-category': {
        const name = formData.get('name')?.toString().trim();
        if (!name) throw new Error('Category name is required');
        store.addCategory({ name, type: formData.get('type')?.toString() ?? 'expense' });
        form.reset();
        showToast('Custom category created');
        break;
      }
      case 'add-planned': {
        const amount = parseNumber(formData.get('amount'));
        const plannedFor = formData.get('plannedFor')?.toString() ?? new Date().toISOString().slice(0, 7);
        store.addPlannedExpense({
          name: formData.get('name')?.toString().trim() ?? 'Planned spend',
          amount,
          categoryId: formData.get('categoryId')?.toString() ?? null,
          plannedFor,
          notes: formData.get('notes')?.toString() ?? ''
        });
        form.reset();
        showToast('Planned expense added');
        break;
      }
      case 'add-recurring': {
        const payload = {
          name: formData.get('name')?.toString().trim() ?? 'Recurring expense',
          amount: parseNumber(formData.get('amount')),
          categoryId: formData.get('categoryId')?.toString() ?? null,
          frequency: formData.get('frequency')?.toString() ?? 'monthly',
          nextDueDate: formData.get('nextDueDate')?.toString() ?? new Date().toISOString(),
          notes: formData.get('notes')?.toString() ?? ''
        };
        store.addRecurringExpense(payload);
        form.reset();
        showToast('Recurring expense captured');
        break;
      }
      case 'add-goal': {
        const payload = {
          name: formData.get('name')?.toString().trim() ?? 'Goal',
          categoryId: formData.get('categoryId')?.toString() ?? null,
          targetAmount: parseNumber(formData.get('targetAmount')),
          currentSavings: parseNumber(formData.get('currentSavings')),
          timeframeMonths: parseNumber(formData.get('timeframeMonths')) || 12,
          riskProfile: formData.get('riskProfile')?.toString() ?? 'balanced'
        };
        store.addGoal(payload);
        form.reset();
        showToast('Goal created');
        break;
      }
      case 'add-insight': {
        const payload = {
          title: formData.get('title')?.toString().trim() ?? 'Insight',
          body: formData.get('body')?.toString() ?? '',
          severity: formData.get('severity')?.toString() ?? 'info'
        };
        store.addInsight(payload);
        form.reset();
        showToast('Insight logged');
        break;
      }
      default:
        break;
    }
    flashSyncIndicator();
  } catch (error) {
    console.error(error);
    showToast(error.message ?? 'Unable to process form', 'error');
  }
}

function handleClick(event) {
  const target = event.target;
  if (target instanceof HTMLButtonElement && target.dataset.view) {
    setView(target.dataset.view);
    return;
  }

  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (!action) return;

  switch (action) {
    case 'mark-planned':
      store.reconcilePlannedExpense(target.dataset.id, null);
      showToast('Planned expense marked as reconciled');
      flashSyncIndicator();
      break;
    case 'delete-planned':
      store.deletePlannedExpense(target.dataset.id);
      showToast('Planned expense removed');
      flashSyncIndicator();
      break;
    case 'bump-recurring': {
      const item = currentState.recurringExpenses.find((entry) => entry.id === target.dataset.id);
      if (item) {
        const nextDate = new Date(item.nextDueDate ?? Date.now());
        if (item.frequency === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else if (item.frequency === 'quarterly') {
          nextDate.setMonth(nextDate.getMonth() + 3);
        } else {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        store.updateRecurringExpense(item.id, { nextDueDate: nextDate.toISOString() });
        showToast(`Next due shifted to ${formatDate(nextDate)}`);
        flashSyncIndicator();
      }
      break;
    }
    case 'delete-recurring':
      store.deleteRecurringExpense(target.dataset.id);
      showToast('Recurring expense removed');
      flashSyncIndicator();
      break;
    case 'goal-up': {
      const goal = currentState.goals.find((entry) => entry.id === target.dataset.id);
      if (goal) {
        store.updateGoal(goal.id, { currentSavings: goal.currentSavings * 1.1 });
        showToast('Monthly contribution uplift simulated');
        flashSyncIndicator();
      }
      break;
    }
    case 'delete-goal':
      store.deleteGoal(target.dataset.id);
      showToast('Goal deleted');
      flashSyncIndicator();
      break;
    default:
      break;
  }
}

async function handleExport() {
  try {
    const payload = await store.exportData();
    if (!payload) {
      showToast('No data available to export', 'error');
      return;
    }
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `wealth-accelerator-${new Date().toISOString()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('Encrypted snapshot downloaded');
  } catch (error) {
    console.error(error);
    showToast('Export failed', 'error');
  }
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    await store.importData(text);
    showToast('Snapshot imported');
  } catch (error) {
    console.error(error);
    showToast('Import failed — ensure the file is valid', 'error');
  } finally {
    importInput.value = '';
  }
}

async function handleReset() {
  await store.reset();
  showToast('Demo data restored');
}

function updateConnectionBanner() {
  if (navigator.onLine) {
    connectionBanner.classList.add('hidden');
  } else {
    connectionBanner.classList.remove('hidden');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  }
}

navElement.addEventListener('click', handleClick);
document.addEventListener('submit', handleFormSubmit);
document.addEventListener('click', handleClick);
exportButton.addEventListener('click', handleExport);
importInput.addEventListener('change', handleImport);
resetButton.addEventListener('click', handleReset);
window.addEventListener('online', updateConnectionBanner);
window.addEventListener('offline', updateConnectionBanner);

store.onChange((state) => {
  currentState = state;
  render();
});

(async function init() {
  updateConnectionBanner();
  renderNav();
  render();
  await store.load();
  registerServiceWorker();
})();
