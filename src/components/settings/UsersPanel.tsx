import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, KeyRound, Trash2, Loader2, AlertCircle, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api.ts';

type Role = 'admin' | 'member';

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

const MIN_PASSWORD = 10;

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-60';

const msg = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export const UsersPanel: React.FC = () => {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // add form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // reset password / delete confirmation state
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ users: ManagedUser[] }>('/api/users');
      setUsers(r.users);
      setError('');
    } catch (err) {
      setError(msg(err, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adding) return;
    setAddError('');
    if (password.length < MIN_PASSWORD) {
      setAddError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setAdding(true);
    try {
      await apiPost('/api/users', { name: name.trim(), email: email.trim(), password, role });
      setName('');
      setEmail('');
      setPassword('');
      setRole('member');
      await load();
    } catch (err) {
      setAddError(msg(err, 'Could not add user.'));
    } finally {
      setAdding(false);
    }
  };

  const run = async (id: string, fn: () => Promise<unknown>, fallback: string) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      await load();
      return true;
    } catch (err) {
      setError(msg(err, fallback));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = (u: ManagedUser, newRole: Role) =>
    run(u.id, () => apiPatch(`/api/users/${u.id}`, { role: newRole }), 'Could not change role.');

  const submitReset = async (u: ManagedUser) => {
    if (resetPw.length < MIN_PASSWORD) {
      setError(`New password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    const ok = await run(
      u.id,
      () => apiPost(`/api/users/${u.id}/reset-password`, { newPassword: resetPw }),
      'Could not reset password.',
    );
    if (ok) {
      setResetId(null);
      setResetPw('');
    }
  };

  const confirmDelete = async (u: ManagedUser) => {
    const ok = await run(u.id, () => apiDelete(`/api/users/${u.id}`), 'Could not delete user.');
    if (ok) setDeleteId(null);
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-teal-700" />
        <h3 className="text-sm font-bold text-slate-900">Users</h3>
        <span className="text-xs text-slate-400">({users.length})</span>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading users...
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {users.map((u) => {
            const isSelf = u.id === me?.id;
            const busy = busyId === u.id;
            return (
              <li key={u.id} className="px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(u.name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-[10rem]">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {u.name}
                      {isSelf && <span className="ml-1.5 text-[10px] font-medium text-slate-400">(you)</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                  </div>

                  <select
                    aria-label={`Role for ${u.name}`}
                    value={u.role}
                    disabled={busy || isSelf}
                    title={isSelf ? 'You cannot change your own role' : undefined}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setResetId(resetId === u.id ? null : u.id);
                      setResetPw('');
                      setDeleteId(null);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs text-slate-700 disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Reset password
                  </button>

                  {!isSelf && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setDeleteId(deleteId === u.id ? null : u.id);
                        setResetId(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 text-xs text-rose-700 disabled:opacity-50"
                      aria-label={`Delete ${u.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                  {busy && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </div>

                {resetId === u.id && (
                  <div className="flex flex-wrap items-center gap-2 pl-11">
                    <label htmlFor={`reset-${u.id}`} className="sr-only">
                      New password for {u.name}
                    </label>
                    <input
                      id={`reset-${u.id}`}
                      type="password"
                      autoComplete="new-password"
                      placeholder={`New password (min ${MIN_PASSWORD} chars)`}
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                      className={`${inputClass} max-w-xs`}
                    />
                    <button
                      type="button"
                      disabled={busy || !resetPw}
                      onClick={() => submitReset(u)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Set password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetId(null);
                        setResetPw('');
                      }}
                      className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {deleteId === u.id && (
                  <div className="flex flex-wrap items-center gap-2 pl-11 text-xs text-rose-700">
                    <span>Delete {u.name}? This cannot be undone.</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirmDelete(u)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(null)}
                      className="flex items-center gap-1 px-2 py-1.5 text-slate-500 hover:text-slate-800"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleAdd} className="border-t border-slate-100 pt-5 space-y-3" noValidate>
        <h4 className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
          <UserPlus className="w-3.5 h-3.5 text-slate-400" /> Add user
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-user-name" className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
            <input id="new-user-name" type="text" autoComplete="off" required value={name} onChange={(e) => setName(e.target.value)} disabled={adding} className={inputClass} />
          </div>
          <div>
            <label htmlFor="new-user-email" className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input id="new-user-email" type="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={adding} className={inputClass} />
          </div>
          <div>
            <label htmlFor="new-user-password" className="block text-xs font-semibold text-slate-700 mb-1">Temporary password</label>
            <input id="new-user-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={adding} className={inputClass} />
            <p className="text-[11px] text-slate-400 mt-1">At least {MIN_PASSWORD} characters.</p>
          </div>
          <div>
            <label htmlFor="new-user-role" className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
            <select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={adding} className={inputClass}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {addError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
            <span>{addError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={adding || !name.trim() || !email.trim() || !password}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          <span>{adding ? 'Adding...' : 'Add user'}</span>
        </button>
      </form>
    </section>
  );
};
