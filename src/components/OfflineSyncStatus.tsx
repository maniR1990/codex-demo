import { useEffect, useState } from 'react';
import { useFinancialStore } from '../store/FinancialStoreProvider';

export function OfflineSyncStatus() {
  const { isSyncing, lastSyncedAt, refresh } = useFinancialStore();
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 md:flex-nowrap">
      <span className={`flex h-3 w-3 rounded-full ${isOnline ? 'bg-success' : 'bg-warning'} animate-pulse`} />
      <div className="text-sm">
        <p className="font-medium">{isOnline ? 'Online' : 'Offline Mode'}</p>
        <p className="text-xs text-slate-400">
          {isSyncing
            ? 'Syncing with secure aggregator...'
            : lastSyncedAt
              ? `Last synced ${new Date(lastSyncedAt).toLocaleString('en-IN')}`
              : 'Local snapshot active'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => refresh()}
        className="ml-auto mt-2 w-full rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-sky-300 disabled:opacity-50 md:ml-auto md:mt-0 md:w-auto"
        disabled={isSyncing}
      >
        Sync
      </button>
    </div>
  );
}
