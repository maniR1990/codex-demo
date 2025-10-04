import { useRef, type ChangeEvent } from 'react';
import { useFinancialStore } from '../store/FinancialStoreProvider';

export function DataControlPanel() {
  const { exportData, exportDataAsCsv, importData } = useFinancialStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
      <h3 className="text-base font-semibold text-slate-100">Data governance & exports</h3>
      <p className="mt-1 text-xs text-slate-500">
        Everything stays on your device: take local backups, download CSV ledgers, and restore data whenever you need it.
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
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={onFileChange} />
      </div>
    </div>
  );
}
