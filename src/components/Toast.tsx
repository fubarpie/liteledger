import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext.tsx';

/** Shows messages raised through useAccounting().notify (e.g. a background save that failed). */
export const Toast: React.FC = () => {
  const { notice, dismissNotice } = useAccounting();

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismissNotice, notice.kind === 'error' ? 10000 : 5000);
    return () => clearTimeout(t);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  const styles = {
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-slate-50 border-slate-200 text-slate-800',
  }[notice.kind];
  const Icon = notice.kind === 'error' ? AlertCircle : notice.kind === 'success' ? CheckCircle2 : Info;

  return (
    <div role="alert" className={`fixed bottom-4 right-4 z-[100] max-w-md flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${styles}`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
      <p className="text-sm flex-1">{notice.message}</p>
      <button onClick={dismissNotice} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
