import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseBackup } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import { apiPost } from '../../api.ts';
import { readLegacyBrowserData, clearLegacyBrowserData } from '../../legacyLocal.ts';

interface LegacyImportProps {
  /** Called after a successful import (and optional cleanup) is finished. */
  onDone?: () => void;
}

export const LegacyImport: React.FC<LegacyImportProps> = ({ onDone }) => {
  const { reload } = useAccounting();
  const [data, setData] = useState(() => readLegacyBrowserData());
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  if (!data && !imported) return null;

  const handleImport = async () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/api/import/legacy', {
        businesses: data.businesses,
        accounts: data.accounts,
        categories: data.categories,
        transactions: data.transactions,
        reconciliations: data.reconciliations,
      });
      setImported(true);
      await reload();
    } catch (err: any) {
      setError(err?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    clearLegacyBrowserData();
    setData(null);
    onDone?.();
  };

  if (imported) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4" /> Import complete
        </div>
        <p className="text-xs mt-1">
          Your old browser data is now saved on the server. You can remove the old copy from this browser.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
          >
            Clear old browser data
          </button>
          <button
            type="button"
            onClick={() => onDone?.()}
            className="px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 rounded-lg"
          >
            Keep it for now
          </button>
        </div>
      </div>
    );
  }

  const c = data!.counts;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <DatabaseBackup className="w-4 h-4 text-indigo-600" />
        Import data from your old LiteLedger/KiteBooks browser storage
      </div>
      <p className="text-xs text-slate-500 mt-1">Found in this browser:</p>
      <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-700">
        <li>{c.businesses} business{c.businesses === 1 ? '' : 'es'}</li>
        <li>{c.accounts} accounts</li>
        <li>{c.categories} categories</li>
        <li>{c.transactions} transactions</li>
        <li>{c.reconciliations} reconciliations</li>
      </ul>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          Some older installs included generated <strong>demo data</strong>. Only import if you entered
          real data into the old version; otherwise you would be importing fake businesses and transactions.
        </div>
      </div>

      <label className="mt-3 flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5"
        />
        <span>This is real data I entered, and I want to import it.</span>
      </label>

      {error && (
        <div role="alert" className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleImport}
        disabled={!confirmed || busy}
        className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
      >
        {busy ? 'Importing...' : 'Import this data'}
      </button>
    </div>
  );
};
