import { useRef, useState, type ChangeEvent } from 'react';
import { useFinancialStore } from '../store/FinancialStoreProvider';

export function DataControlPanel() {
  const {
    exportData,
    exportDataAsCsv,
    importData,
    resetLedger
  } = useFinancialStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleExport = async () => {
    const blob = await exportData();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `wealth-accelerator-backup-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await importData(file);
    }
  };

  const handleCsvExport = async () => {
    const blob = await exportDataAsCsv();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `wealth-accelerator-ledger-${new Date().toISOString()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const confirmReset = async () => {
    setIsResetting(true);
    try {
      await resetLedger();
      setIsResetDialogOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
      <h3 className="text-base font-semibold text-slate-100">Data governance & exports</h3>
      <p className="mt-1 text-xs text-slate-500">
        Everything stays local: save file-based backups, export your ledger, and restore data on any device.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-300"
        >
          Download JSON backup
        </button>
        <button
          type="button"
          onClick={handleCsvExport}
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
        >
          Download CSV snapshot
        </button>
        <button
          type="button"
          onClick={handleImport}
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
        >
          Restore backup
        </button>
        <button
          type="button"
          onClick={() => setIsResetDialogOpen(true)}
          className="rounded-lg border border-danger px-4 py-2 text-xs font-semibold text-danger hover:bg-danger/10"
        >
          Reset ledger
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={onFileChange} />
      </div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        <p className="font-semibold text-slate-200">File-based backups</p>
        <p>
          Keep your financial data portable by exporting JSON or CSV files. Restore from a saved backup whenever you
          need to sync another device.
        </p>
      </div>
      {isResetDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-danger">Reset ledger?</h4>
            <p className="mt-2 text-xs text-slate-400">
              This will permanently clear all locally stored accounts, transactions, plans, and insights. Make sure you
              have exported a backup before continuing.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                onClick={() => setIsResetDialogOpen(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-danger px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-danger/90 disabled:opacity-70"
                onClick={confirmReset}
                disabled={isResetting}
              >
                {isResetting ? 'Clearing…' : 'Yes, clear everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
