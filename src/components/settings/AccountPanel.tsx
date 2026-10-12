import React, { useState } from 'react';
import { UserCircle, KeyRound, LogOut, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

const MIN_PASSWORD = 10;

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-60';

export const AccountPanel: React.FC = () => {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setSuccess(false);
    if (next.length < MIN_PASSWORD) {
      setError(`New password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
            <UserCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{user.name}</h3>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              user.role === 'admin' ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {user.role}
          </span>
        </div>
        <button
          type="button"
          onClick={() => logout().catch(() => {})}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-100 pt-5 space-y-3 max-w-md" noValidate>
        <h4 className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
          <KeyRound className="w-3.5 h-3.5 text-slate-400" />
          Change password
        </h4>
        <div>
          <label htmlFor="acct-current" className="block text-xs font-semibold text-slate-700 mb-1">
            Current password
          </label>
          <input
            id="acct-current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="acct-new" className="block text-xs font-semibold text-slate-700 mb-1">
            New password
          </label>
          <input
            id="acct-new"
            type="password"
            autoComplete="new-password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
          <p className="text-[11px] text-slate-400 mt-1">At least {MIN_PASSWORD} characters.</p>
        </div>
        <div>
          <label htmlFor="acct-confirm" className="block text-xs font-semibold text-slate-700 mb-1">
            Confirm new password
          </label>
          <input
            id="acct-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-px" />
            <span>Password updated.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !current || !next || !confirm}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{busy ? 'Updating...' : 'Update password'}</span>
        </button>
      </form>
    </section>
  );
};
