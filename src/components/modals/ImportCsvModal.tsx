import React, { useState } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import { X, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Transaction } from '../../types.ts';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({ isOpen, onClose }) => {
  const { activeBusiness, accounts, addBatchTransactions } = useAccounting();

  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      parseCsv(content);
    };
    reader.readAsText(file);
  };

  const parseCsv = (text: string) => {
    setParseError(null);
    try {
      const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setParseError('CSV must have a header row and at least 1 data row.');
        setParsedRows([]);
        return;
      }

      // Simple CSV split handling quotes
      const splitLine = (line: string) => {
        const result: string[] = [];
        let cur = '';
        let insideQuote = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            insideQuote = !insideQuote;
          } else if (char === ',' && !insideQuote) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const header = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

      // Find indices
      let dateIdx = header.findIndex((h) => h.includes('date'));
      let descIdx = header.findIndex(
        (h) => h.includes('desc') || h.includes('payee') || h.includes('name') || h.includes('memo')
      );
      let amountIdx = header.findIndex(
        (h) => h.includes('amount') || h.includes('total') || h.includes('debit') || h.includes('credit')
      );

      if (dateIdx === -1) dateIdx = 0;
      if (descIdx === -1) descIdx = 1;
      if (amountIdx === -1) amountIdx = 2;

      const parsed: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        if (cols.length < 2) continue;

        const rawDate = cols[dateIdx] || new Date().toISOString().split('T')[0];
        const rawDesc = cols[descIdx] || 'Bank Transaction';
        const rawAmountStr = (cols[amountIdx] || '0').replace(/[\$,]/g, '');
        const amount = parseFloat(rawAmountStr) || 0;

        // Normalize date to YYYY-MM-DD
        let formattedDate = rawDate;
        if (rawDate.includes('/')) {
          const parts = rawDate.split('/');
          if (parts.length === 3) {
            const m = parts[0].padStart(2, '0');
            const d = parts[1].padStart(2, '0');
            let y = parts[2];
            if (y.length === 2) y = `20${y}`;
            formattedDate = `${y}-${m}-${d}`;
          }
        }

        parsed.push({
          date: formattedDate,
          description: rawDesc,
          amount,
        });
      }

      setParsedRows(parsed);
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse CSV');
      setParsedRows([]);
    }
  };

  const handleImport = () => {
    if (parsedRows.length === 0) return;

    const targetAccount = accounts.some((a) => a.id === accountId) ? accountId : accounts[0]?.id;
    if (!targetAccount) {
      setParseError('Add an account for this business first (Settings → Accounts), then import.');
      return;
    }
    const txsToInsert: Omit<Transaction, 'id'>[] = parsedRows.map((r) => ({
      businessId: activeBusiness.id,
      accountId: targetAccount,
      date: r.date,
      payee: r.description,
      description: r.description,
      amount: r.amount,
      categoryId: null, // Uncategorized; categorize manually or with AI afterwards
      reconciled: false,
      source: 'csv_import',
    }));

    addBatchTransactions(txsToInsert);
    alert(`Successfully imported ${txsToInsert.length} transactions into ${activeBusiness.name}!`);
    onClose();
  };

  const loadSampleCsv = () => {
    const sample = `Date,Description,Amount\n2026-10-09,OFFICE DEPOT #2940 PAPER & INK,-68.45\n2026-10-08,CLIENT INVOICE #1049 ACH PAYMENT,2400.00\n2026-10-07,CHEVRON GAS STATION FUEL TRUCK,-58.20\n2026-10-06,ZOOM VIDEO COMMUNICATIONS,-15.99`;
    setCsvText(sample);
    parseCsv(sample);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Import Bank Statement (CSV)
              </h2>
              <p className="text-xs text-slate-500">
                Upload or paste transactions from any bank or credit card export
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Destination Account
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (•••• {a.accountNumberLast4})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Upload CSV File or Paste Raw Text
              </label>
              <button
                type="button"
                onClick={loadSampleCsv}
                className="text-[11px] text-teal-700 hover:underline"
              >
                Load Sample CSV
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
              />
            </div>

            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                parseCsv(e.target.value);
              }}
              placeholder="Date,Description,Amount&#10;2026-10-09,OFFICE DEPOT,-68.45&#10;2026-10-08,CLIENT PAYMENT,2400.00"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
            />
          </div>

          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Preview Parsed */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 mb-2">
                <span>Preview Ready to Import ({parsedRows.length} transactions)</span>
                <span className="text-emerald-700 font-normal">Parsed successfully</span>
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {parsedRows.slice(0, 10).map((r, i) => (
                  <div key={i} className="p-2 flex items-center justify-between font-mono text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-slate-400">{r.date}</span>
                      <span className="text-slate-800 truncate">{r.description}</span>
                    </div>
                    <span
                      className={`font-bold ${r.amount > 0 ? 'text-emerald-700' : 'text-slate-900'}`}
                    >
                      {r.amount > 0 ? '+' : ''}${r.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              {parsedRows.length > 10 && (
                <div className="text-[10px] text-slate-400 mt-1 text-center">
                  Showing first 10 of {parsedRows.length} rows...
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={parsedRows.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              Import {parsedRows.length} Transactions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
