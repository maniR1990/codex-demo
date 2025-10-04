import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useFinancialStore } from '../store/FinancialStoreProvider';

export function DataControlPanel() {
  const {
    exportData,
    exportDataAsCsv,
    exportGitSnapshot,
    importData,
    commitToGit,
    gitStatus,
    gitHistory,
    refreshGitHistory,
    smartExportRules,
    addSmartExportRule,
    deleteSmartExportRule
  } = useFinancialStore();
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

  const handleGitCommit = async () => {
    const defaultMessage = `Manual snapshot ${new Date().toISOString()}`;
    const message = window.prompt('Commit message for Git snapshot', defaultMessage);
    if (!message) return;
    await commitToGit(message, { encrypt: true });
    await refreshGitHistory();
  };

  const handleGitArchive = async () => {
    const blob = await exportGitSnapshot();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `wealth-accelerator-git-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const lastCommit = gitHistory[0];
  const [ruleForm, setRuleForm] = useState({ name: '', type: 'weekly' as 'weekly' | 'transaction-count', threshold: 7, gpgKeyFingerprint: '' });

  const handleRuleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ruleForm.name.trim()) return;
    await addSmartExportRule({
      name: ruleForm.name,
      type: ruleForm.type,
      threshold: Number(ruleForm.threshold),
      target: 'git',
      gpgKeyFingerprint: ruleForm.gpgKeyFingerprint || undefined
    });
    setRuleForm({ name: '', type: ruleForm.type, threshold: ruleForm.type === 'weekly' ? 7 : 100, gpgKeyFingerprint: '' });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
      <h3 className="text-base font-semibold text-slate-100">Data governance & exports</h3>
      <p className="mt-1 text-xs text-slate-500">
        Everything stays free: take local backups, publish encrypted Git revisions, and restore data on any device.
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
          onClick={handleGitCommit}
          className="rounded-lg border border-accent/60 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/10"
        >
          Commit to Git (encrypted)
        </button>
        <button
          type="button"
          onClick={handleGitArchive}
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
        >
          Export Git bundle
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
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        <p className="font-semibold text-slate-200">Git status</p>
        <p>HEAD: {gitStatus.head ?? 'no commits yet'}</p>
        <p>Remotes: {gitStatus.remotes.length > 0 ? gitStatus.remotes.map((remote) => remote.remote).join(', ') : 'none'}</p>
        {lastCommit && (
          <p className="mt-1 text-slate-300">
            Last commit {new Date(lastCommit.committedAt).toLocaleString('en-IN')} — {lastCommit.message}
          </p>
        )}
      </div>
      <section className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">Smart export automation</p>
          <span className="text-[10px] uppercase text-slate-500">Optional encrypted Git rules</span>
        </header>
        <form onSubmit={handleRuleSubmit} className="grid gap-2 sm:grid-cols-4">
          <input
            required
            value={ruleForm.name}
            onChange={(event) => setRuleForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs sm:col-span-2"
            placeholder="Rule name"
          />
          <select
            value={ruleForm.type}
            onChange={(event) => {
              const value = event.target.value as 'weekly' | 'transaction-count';
              setRuleForm((prev) => ({ ...prev, type: value, threshold: value === 'weekly' ? 7 : 100 }));
            }}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs"
          >
            <option value="weekly">Weekly cadence (days)</option>
            <option value="transaction-count">Transaction count threshold</option>
          </select>
          <input
            type="number"
            min={ruleForm.type === 'weekly' ? 1 : 1}
            value={ruleForm.threshold}
            onChange={(event) => setRuleForm((prev) => ({ ...prev, threshold: Number(event.target.value) }))}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs"
            placeholder="Threshold"
          />
          <input
            value={ruleForm.gpgKeyFingerprint}
            onChange={(event) => setRuleForm((prev) => ({ ...prev, gpgKeyFingerprint: event.target.value }))}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs sm:col-span-3"
            placeholder="Optional GPG fingerprint for encrypted commits"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-300"
          >
            Add rule
          </button>
        </form>
        <ul className="space-y-2 text-xs">
          {smartExportRules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-200">{rule.name}</p>
                <p className="text-[11px] text-slate-500">
                  {rule.type === 'weekly'
                    ? `Commits every ${rule.threshold} day(s)`
                    : `Commits after ${rule.threshold} new transactions`}
                  {rule.lastTriggeredAt && ` • Last run ${new Date(rule.lastTriggeredAt).toLocaleString('en-IN')}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteSmartExportRule(rule.id)}
                className="self-start rounded-lg border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
              >
                Remove
              </button>
            </li>
          ))}
          {smartExportRules.length === 0 && <p className="text-[11px] text-slate-500">No automation rules configured yet.</p>}
        </ul>
      </section>
    </div>
  );
}
