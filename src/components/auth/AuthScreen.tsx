import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, AlertCircle, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

const MIN_PASSWORD = 10;

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-60';

export const AuthScreen: React.FC = () => {
  const { setupRequired, setup, login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    if (setupRequired) {
      if (password.length < MIN_PASSWORD) {
        setError(`Password must be at least ${MIN_PASSWORD} characters.`);
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      if (setupRequired) {
        await setup({ name: name.trim(), email: email.trim(), password });
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const toggle = (
    <button
      type="button"
      onClick={() => setShowPassword((s) => !s)}
      className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-lg bg-teal-700 flex items-center justify-center text-white shadow-xs font-bold text-xl">
            K
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">LiteLedger</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">
            {setupRequired ? 'Welcome to LiteLedger' : 'Sign in'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {setupRequired
              ? 'Create your administrator account to get started.'
              : 'Enter your credentials to access your books.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {setupRequired && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  className={inputClass}
                  placeholder="Your full name"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                autoFocus={!setupRequired}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={setupRequired ? 'new-password' : 'current-password'}
                  required
                  minLength={setupRequired ? MIN_PASSWORD : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className={`${inputClass} pr-10`}
                />
                {toggle}
              </div>
              {setupRequired && (
                <p className="text-[11px] text-slate-400 mt-1">At least {MIN_PASSWORD} characters.</p>
              )}
            </div>

            {setupRequired && (
              <div>
                <label htmlFor="auth-confirm" className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm password
                </label>
                <input
                  id="auth-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={busy}
                  className={inputClass}
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 shadow-xs transition-colors disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : setupRequired ? (
                <UserPlus className="w-4 h-4" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>
                {busy
                  ? setupRequired
                    ? 'Creating account...'
                    : 'Signing in...'
                  : setupRequired
                    ? 'Create administrator account'
                    : 'Sign in'}
              </span>
            </button>
          </form>

          {setupRequired && (
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-teal-600 flex-shrink-0 mt-px" />
              <span>
                This account will be the administrator and can add other users later. All of your data
                is stored on this server.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
