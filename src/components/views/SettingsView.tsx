import React, { useRef, useState } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiPost } from '../../api.ts';
import { AccountPanel } from '../settings/AccountPanel.tsx';
import { UsersPanel } from '../settings/UsersPanel.tsx';
import { LegacyImport } from '../onboarding/LegacyImport.tsx';
import { Plus, Edit2, Trash2, Download, Upload, AlertTriangle, Info } from 'lucide-react';
import { Business, Account, Category } from '../../types.ts';

interface SettingsViewProps {
  onOpenAddBusiness: () => void;
}

const STRUCTURES: Business['structure'][] = [
  'LLC',
  'Sole Proprietorship',
  'S-Corporation',
  'Partnership',
  'C-Corporation',
];
const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'MXN'];
const ACCOUNT_TYPES: { value: Account['type']; label: string }[] = [
  { value: 'checking', label: 'Checking Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'credit_card', label: 'Business Credit Card' },
  { value: 'loan', label: 'Equipment / Business Loan' },
  { value: 'mortgage', label: 'Commercial Mortgage' },
  { value: 'other', label: 'Other' },
];
const CATEGORY_TYPES: { value: Category['type']; label: string }[] = [
  { value: 'expense', label: 'Operating Expense' },
  { value: 'cogs', label: 'Cost of Goods Sold (COGS)' },
  { value: 'income', label: 'Income / Revenue' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'equity', label: 'Owner Equity / Draw' },
];

const inputCls = 'w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenAddBusiness }) => {
  const {
    businesses,
    activeBusiness,
    setActiveBusinessId,
    updateBusiness,
    deleteBusiness,
    accounts,
    addAccount,
    updateAccount,
    deleteAccount,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    transactions,
    reload,
  } = useAccounting();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'entities' | 'accounts' | 'categories'>('entities');

  // Business editing
  const [editingBizId, setEditingBizId] = useState<string | null>(null);
  const [editBizForm, setEditBizForm] = useState<Partial<Business>>({});
  const [confirmDeleteBizId, setConfirmDeleteBizId] = useState<string | null>(null);

  // Account add / edit
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    type: 'checking' as Account['type'],
    institution: '',
    accountNumberLast4: '',
    currentBalance: '0',
  });
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editAccForm, setEditAccForm] = useState({
    name: '',
    type: 'checking' as Account['type'],
    institution: '',
    accountNumberLast4: '',
    currentBalance: '0',
  });
  const [confirmDeleteAccId, setConfirmDeleteAccId] = useState<string | null>(null);

  // Category add / edit
  const emptyCat = {
    name: '',
    type: 'expense' as Category['type'],
    scheduleCLine: 'Line 27a: Other expenses',
    description: '',
    isTaxDeductible: true,
    color: '#0f766e',
  };
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [newCatForm, setNewCatForm] = useState(emptyCat);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState(emptyCat);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);

  // Backup / restore
  const restoreInput = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<{ name: string; data: any } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  // ---- businesses ----
  const handleStartEditBiz = (biz: Business) => {
    setEditingBizId(biz.id);
    setEditBizForm({ ...biz });
  };

  const handleSaveEditBiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBizId) return;
    const { id: _id, createdDate: _cd, ...updates } = editBizForm as Business;
    updateBusiness(editingBizId, {
      ...updates,
      name: (updates.name || '').trim(),
      legalName: (updates.legalName || '').trim(),
      ein: (updates.ein || '').trim(),
      industry: (updates.industry || '').trim(),
    });
    setEditingBizId(null);
  };

  // ---- accounts ----
  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.name.trim()) return;
    const bal = parseFloat(newAccountForm.currentBalance) || 0;
    addAccount({
      businessId: activeBusiness.id,
      name: newAccountForm.name.trim(),
      type: newAccountForm.type,
      institution: newAccountForm.institution.trim() || 'Bank',
      accountNumberLast4: newAccountForm.accountNumberLast4.trim() || '0000',
      currentBalance: bal,
      availableBalance: bal,
    });
    setNewAccountForm({ name: '', type: 'checking', institution: '', accountNumberLast4: '', currentBalance: '0' });
    setShowAddAccountForm(false);
  };

  const startEditAccount = (a: Account) => {
    setEditingAccId(a.id);
    setConfirmDeleteAccId(null);
    setEditAccForm({
      name: a.name,
      type: a.type,
      institution: a.institution,
      accountNumberLast4: a.accountNumberLast4,
      currentBalance: String(a.currentBalance),
    });
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccId || !editAccForm.name.trim()) return;
    updateAccount(editingAccId, {
      name: editAccForm.name.trim(),
      type: editAccForm.type,
      institution: editAccForm.institution.trim(),
      accountNumberLast4: editAccForm.accountNumberLast4.trim(),
      currentBalance: parseFloat(editAccForm.currentBalance) || 0,
    });
    setEditingAccId(null);
  };

  // ---- categories ----
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatForm.name.trim()) return;
    addCategory({
      name: newCatForm.name.trim(),
      type: newCatForm.type,
      scheduleCLine: newCatForm.scheduleCLine.trim(),
      description: newCatForm.description.trim() || undefined,
      isTaxDeductible: newCatForm.isTaxDeductible,
      color: newCatForm.color,
    });
    setNewCatForm(emptyCat);
    setShowAddCategoryForm(false);
  };

  const startEditCategory = (c: Category) => {
    setEditingCatId(c.id);
    setConfirmDeleteCatId(null);
    setEditCatForm({
      name: c.name,
      type: c.type,
      scheduleCLine: c.scheduleCLine || '',
      description: c.description || '',
      isTaxDeductible: c.isTaxDeductible,
      color: c.color || '#0f766e',
    });
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCatId || !editCatForm.name.trim()) return;
    updateCategory(editingCatId, {
      name: editCatForm.name.trim(),
      type: editCatForm.type,
      scheduleCLine: editCatForm.scheduleCLine.trim(),
      description: editCatForm.description.trim(),
      isTaxDeductible: editCatForm.isTaxDeductible,
      color: editCatForm.color,
    });
    setEditingCatId(null);
  };

  // ---- restore ----
  const handlePickRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestoreMsg(null);
    try {
      const data = JSON.parse(await file.text());
      setPendingRestore({ name: file.name, data });
    } catch {
      setRestoreMsg({ kind: 'error', text: 'That file is not valid JSON.' });
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      await apiPost('/api/backup/restore', pendingRestore.data);
      await reload();
      setRestoreMsg({ kind: 'success', text: 'Backup restored. All data has been replaced.' });
    } catch (err: any) {
      setRestoreMsg({ kind: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setRestoring(false);
      setPendingRestore(null);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: activeBusiness.currency || 'USD' }).format(val);

  const tabBtn = (id: typeof activeTab, label: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
        activeTab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  const primaryBtn =
    'px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded shadow-xs';
  const cancelBtn = 'px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Settings & Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure business entities, bank & loan accounts, categories, your login and your data.
          </p>
        </div>
        <div className="p-1 bg-slate-100 rounded-lg flex items-center gap-1 overflow-x-auto">
          {tabBtn('entities', `Business Entities (${businesses.length})`)}
          {tabBtn('accounts', `Bank & Card Accounts (${accounts.length})`)}
          {tabBtn('categories', `Chart of Accounts (${categories.length})`)}
        </div>
      </div>

      {/* Tab 1: Business Entities */}
      {activeTab === 'entities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Your Businesses</h2>
            <button
              onClick={onOpenAddBusiness}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Business</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {businesses.map((biz) => {
              const isCurrent = biz.id === activeBusiness.id;
              const isEditing = editingBizId === biz.id;

              return (
                <div
                  key={biz.id}
                  className={`bg-white rounded-xl border p-5 shadow-xs transition-all space-y-4 ${
                    isCurrent ? 'border-teal-500 ring-1 ring-teal-500/20' : 'border-slate-200'
                  }`}
                >
                  {!isEditing ? (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: biz.color || '#0f766e' }}
                          />
                          <div>
                            <div className="text-sm font-bold text-slate-900">{biz.name}</div>
                            <div className="text-xs text-slate-500">{biz.legalName}</div>
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                            Currently Active
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Structure:</span>
                          <span className="font-medium">{biz.structure}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">EIN / Tax ID:</span>
                          <span className="font-mono font-medium">{biz.ein || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Industry:</span>
                          <span className="font-medium truncate">{biz.industry || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Fiscal Year End:</span>
                          <span className="font-medium">{biz.fiscalYearEnd}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Currency:</span>
                          <span className="font-medium">{biz.currency}</span>
                        </div>
                      </div>

                      {confirmDeleteBizId === biz.id ? (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                          <span>Delete {biz.name} and ALL its accounts, categories and transactions?</span>
                          <span className="flex items-center gap-2 shrink-0">
                            <button onClick={() => setConfirmDeleteBizId(null)} className="text-slate-600">
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                deleteBusiness(biz.id);
                                setConfirmDeleteBizId(null);
                              }}
                              className="px-2 py-1 bg-rose-600 text-white rounded font-semibold"
                            >
                              Delete
                            </button>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-1">
                          {!isCurrent ? (
                            <button
                              onClick={() => setActiveBusinessId(biz.id)}
                              className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                            >
                              Switch to this Business →
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Selected</span>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartEditBiz(biz)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {businesses.length > 1 && (
                              <button
                                onClick={() => setConfirmDeleteBizId(biz.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete business"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <form onSubmit={handleSaveEditBiz} className="space-y-3">
                      <div>
                        <label className={labelCls}>Business Display Name</label>
                        <input
                          type="text"
                          value={editBizForm.name || ''}
                          onChange={(e) => setEditBizForm({ ...editBizForm, name: e.target.value })}
                          className={inputCls}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Legal Name</label>
                        <input
                          type="text"
                          value={editBizForm.legalName || ''}
                          onChange={(e) => setEditBizForm({ ...editBizForm, legalName: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Structure</label>
                          <select
                            value={editBizForm.structure || 'LLC'}
                            onChange={(e) =>
                              setEditBizForm({ ...editBizForm, structure: e.target.value as Business['structure'] })
                            }
                            className={inputCls}
                          >
                            {STRUCTURES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>EIN</label>
                          <input
                            type="text"
                            value={editBizForm.ein || ''}
                            onChange={(e) => setEditBizForm({ ...editBizForm, ein: e.target.value })}
                            placeholder="12-3456789"
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Industry</label>
                        <input
                          type="text"
                          value={editBizForm.industry || ''}
                          onChange={(e) => setEditBizForm({ ...editBizForm, industry: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={labelCls}>Fiscal Year End</label>
                          <input
                            type="text"
                            value={editBizForm.fiscalYearEnd || ''}
                            onChange={(e) => setEditBizForm({ ...editBizForm, fiscalYearEnd: e.target.value })}
                            placeholder="MM-DD"
                            pattern="\d{2}-\d{2}"
                            title="Format MM-DD, e.g. 12-31"
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Currency</label>
                          <select
                            value={editBizForm.currency || 'USD'}
                            onChange={(e) => setEditBizForm({ ...editBizForm, currency: e.target.value })}
                            className={inputCls}
                          >
                            {Array.from(new Set([...CURRENCIES, editBizForm.currency || 'USD'])).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Color</label>
                          <input
                            type="color"
                            value={editBizForm.color || '#0f766e'}
                            onChange={(e) => setEditBizForm({ ...editBizForm, color: e.target.value })}
                            className="w-full h-8 px-1 py-1 rounded border border-slate-300 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setEditingBizId(null)} className={cancelBtn}>
                          Cancel
                        </button>
                        <button type="submit" className={primaryBtn}>
                          Save Changes
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Accounts */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Accounts for {activeBusiness.name}</h2>
              <p className="text-xs text-slate-500">
                Checking, savings, credit cards, equipment loans, and commercial mortgages
              </p>
            </div>
            <button
              onClick={() => setShowAddAccountForm(!showAddAccountForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Account</span>
            </button>
          </div>

          {showAddAccountForm && (
            <form
              onSubmit={handleCreateAccount}
              className="bg-white p-4 rounded-xl border border-teal-300 shadow-xs space-y-3 animate-in fade-in"
            >
              <h3 className="text-xs font-bold text-teal-900 uppercase">New Account Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Account Name</label>
                  <input
                    type="text"
                    value={newAccountForm.name}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                    placeholder="e.g., Primary Business Checking"
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select
                    value={newAccountForm.type}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, type: e.target.value as Account['type'] })}
                    className={inputCls}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Institution / Bank</label>
                  <input
                    type="text"
                    value={newAccountForm.institution}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, institution: e.target.value })}
                    placeholder="e.g., Chase, Wells Fargo"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newAccountForm.accountNumberLast4}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, accountNumberLast4: e.target.value })}
                    placeholder="1234"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Initial Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccountForm.currentBalance}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, currentBalance: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddAccountForm(false)} className={cancelBtn}>
                  Cancel
                </button>
                <button type="submit" className={primaryBtn}>
                  Add Account
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Last 4</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No accounts yet. Add one to start recording transactions.
                    </td>
                  </tr>
                )}
                {accounts.map((acc) => {
                  const txCount = transactions.filter((t) => t.accountId === acc.id).length;
                  if (editingAccId === acc.id) {
                    return (
                      <tr key={acc.id} className="bg-teal-50/30">
                        <td colSpan={6} className="p-4">
                          <form onSubmit={handleSaveAccount} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div>
                                <label className={labelCls}>Account Name</label>
                                <input
                                  type="text"
                                  value={editAccForm.name}
                                  onChange={(e) => setEditAccForm({ ...editAccForm, name: e.target.value })}
                                  className={inputCls}
                                  required
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Type</label>
                                <select
                                  value={editAccForm.type}
                                  onChange={(e) =>
                                    setEditAccForm({ ...editAccForm, type: e.target.value as Account['type'] })
                                  }
                                  className={inputCls}
                                >
                                  {ACCOUNT_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className={labelCls}>Institution / Bank</label>
                                <input
                                  type="text"
                                  value={editAccForm.institution}
                                  onChange={(e) => setEditAccForm({ ...editAccForm, institution: e.target.value })}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Last 4 Digits</label>
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={editAccForm.accountNumberLast4}
                                  onChange={(e) =>
                                    setEditAccForm({ ...editAccForm, accountNumberLast4: e.target.value })
                                  }
                                  className={`${inputCls} font-mono`}
                                />
                              </div>
                              <div className="sm:col-span-1 lg:col-span-2">
                                <label className={labelCls}>Current Balance (manual adjustment)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editAccForm.currentBalance}
                                  onChange={(e) => setEditAccForm({ ...editAccForm, currentBalance: e.target.value })}
                                  className={`${inputCls} font-mono`}
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                  Balances normally track your transactions automatically. Only change this to correct
                                  a starting balance.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => setEditingAccId(null)} className={cancelBtn}>
                                Cancel
                              </button>
                              <button type="submit" className={primaryBtn}>
                                Save Changes
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }
                  if (confirmDeleteAccId === acc.id) {
                    return (
                      <tr key={acc.id} className="bg-rose-50/60">
                        <td colSpan={6} className="py-3 px-4">
                          <div className="flex items-center justify-between gap-3 text-[11px] text-rose-800">
                            <span className="flex items-start gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>
                                Delete <strong>{acc.name}</strong>? Its {txCount} transaction
                                {txCount === 1 ? '' : 's'} will be permanently deleted too. This can't be undone.
                              </span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <button onClick={() => setConfirmDeleteAccId(null)} className="text-slate-600">
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  deleteAccount(acc.id);
                                  setConfirmDeleteAccId(null);
                                }}
                                className="px-2 py-1 bg-rose-600 text-white rounded font-semibold"
                              >
                                Delete account & transactions
                              </button>
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-900">{acc.name}</td>
                      <td className="py-3 px-4 text-slate-600">{acc.institution}</td>
                      <td className="py-3 px-4 capitalize text-slate-600">{acc.type.replace('_', ' ')}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">•••• {acc.accountNumberLast4}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(acc.currentBalance)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => startEditAccount(acc)}
                          className="p-1 text-slate-400 hover:text-slate-800 rounded"
                          title="Edit account"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingAccId(null);
                            setConfirmDeleteAccId(acc.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Categories */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Chart of Accounts & Categories</h2>
              <p className="text-xs text-slate-500">
                Categories mapped to IRS Schedule C lines for automatic tax classification
              </p>
            </div>
            <button
              onClick={() => setShowAddCategoryForm(!showAddCategoryForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Category</span>
            </button>
          </div>

          {showAddCategoryForm && (
            <form
              onSubmit={handleCreateCategory}
              className="bg-white p-4 rounded-xl border border-teal-300 shadow-xs space-y-3 animate-in fade-in"
            >
              <h3 className="text-xs font-bold text-teal-900 uppercase">New Category Details</h3>
              <CategoryFields form={newCatForm} setForm={setNewCatForm} />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddCategoryForm(false)} className={cancelBtn}>
                  Cancel
                </button>
                <button type="submit" className={primaryBtn}>
                  Save Category
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">IRS Schedule C Line Mapping</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Tax Deductible</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => {
                  if (editingCatId === c.id) {
                    return (
                      <tr key={c.id} className="bg-teal-50/30">
                        <td colSpan={6} className="p-4">
                          <form onSubmit={handleSaveCategory} className="space-y-3">
                            <CategoryFields form={editCatForm} setForm={setEditCatForm} />
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => setEditingCatId(null)} className={cancelBtn}>
                                Cancel
                              </button>
                              <button type="submit" className={primaryBtn}>
                                Save Changes
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }
                  if (confirmDeleteCatId === c.id) {
                    const n = transactions.filter((t) => t.categoryId === c.id).length;
                    return (
                      <tr key={c.id} className="bg-rose-50/60">
                        <td colSpan={6} className="py-3 px-4">
                          <div className="flex items-center justify-between gap-3 text-[11px] text-rose-800">
                            <span className="flex items-start gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>
                                Delete <strong>{c.name}</strong>? Its {n} transaction{n === 1 ? '' : 's'} will become
                                uncategorized.
                              </span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <button onClick={() => setConfirmDeleteCatId(null)} className="text-slate-600">
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  deleteCategory(c.id);
                                  setConfirmDeleteCatId(null);
                                }}
                                className="px-2 py-1 bg-rose-600 text-white rounded font-semibold"
                              >
                                Delete category
                              </button>
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-slate-200"
                            style={{ backgroundColor: c.color || '#e2e8f0' }}
                          />
                          {c.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 capitalize text-slate-600">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            c.type === 'income'
                              ? 'bg-emerald-50 text-emerald-700'
                              : c.type === 'cogs'
                              ? 'bg-amber-50 text-amber-700'
                              : c.type === 'expense'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {c.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">{c.scheduleCLine}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                        {c.description || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {c.isTaxDeductible ? (
                          <span className="text-emerald-600 font-bold">Yes</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => startEditCategory(c)}
                          className="p-1 text-slate-400 hover:text-slate-800 rounded"
                          title="Edit category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingCatId(null);
                            setConfirmDeleteCatId(c.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* My Account */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">My Account</h2>
        <AccountPanel />
      </section>

      {/* Users (admin) */}
      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Users & Access</h2>
          <UsersPanel />
        </section>
      )}

      {/* Data & Backup */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Data & Backup</h2>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Download a complete JSON backup of all businesses, accounts, categories, transactions and reconciliations.
            You own your financial data.
          </p>
          <a
            href="/api/backup"
            download
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download backup</span>
          </a>

          {isAdmin && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-bold text-slate-800">Restore from backup</h3>
              <p className="text-xs text-slate-500">
                Restoring replaces <strong>all</strong> current data with the contents of a backup file.
              </p>
              <input
                ref={restoreInput}
                type="file"
                accept="application/json,.json"
                onChange={handlePickRestoreFile}
                className="hidden"
              />
              {!pendingRestore && (
                <button
                  onClick={() => restoreInput.current?.click()}
                  disabled={restoring}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restore from backup</span>
                </button>
              )}
              {pendingRestore && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-[11px] text-rose-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      <strong>Warning:</strong> restoring <span className="font-mono">{pendingRestore.name}</span> will
                      permanently REPLACE ALL data in LiteLedger (every business, account, category, transaction and
                      reconciliation). Download a backup first if you might need the current data.
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setPendingRestore(null)}
                      disabled={restoring}
                      className="px-3 py-1.5 text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmRestore}
                      disabled={restoring}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold disabled:opacity-50"
                    >
                      {restoring ? 'Restoring…' : 'Replace all data'}
                    </button>
                  </div>
                </div>
              )}
              {restoreMsg && (
                <div
                  className={`text-[11px] font-medium ${
                    restoreMsg.kind === 'error' ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {restoreMsg.text}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-slate-800">Import from old browser storage</h3>
            <p className="text-xs text-slate-500 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>If you used an older, browser-only version of LiteLedger, you can bring that data over here.</span>
            </p>
            <LegacyImport />
          </div>
        </div>
      </section>
    </div>
  );
};

interface CatForm {
  name: string;
  type: Category['type'];
  scheduleCLine: string;
  description: string;
  isTaxDeductible: boolean;
  color: string;
}

const CategoryFields: React.FC<{ form: CatForm; setForm: (f: CatForm) => void }> = ({ form, setForm }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    <div>
      <label className={labelCls}>Category Name</label>
      <input
        type="text"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="e.g., Software Subscriptions"
        className={inputCls}
        required
      />
    </div>
    <div>
      <label className={labelCls}>Type</label>
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value as Category['type'] })}
        className={inputCls}
      >
        {CATEGORY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
    <div>
      <label className={labelCls}>IRS Schedule C Line</label>
      <input
        type="text"
        value={form.scheduleCLine}
        onChange={(e) => setForm({ ...form, scheduleCLine: e.target.value })}
        placeholder="e.g., Line 18: Office expense"
        className={inputCls}
      />
    </div>
    <div className="sm:col-span-2">
      <label className={labelCls}>Description</label>
      <input
        type="text"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Optional — helps AI categorization"
        className={inputCls}
      />
    </div>
    <div className="flex items-end gap-4">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pb-1.5">
        <input
          type="checkbox"
          checked={form.isTaxDeductible}
          onChange={(e) => setForm({ ...form, isTaxDeductible: e.target.checked })}
          className="rounded text-teal-600"
        />
        Tax deductible
      </label>
      <div>
        <label className={labelCls}>Color</label>
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value })}
          className="h-8 w-12 px-1 py-1 rounded border border-slate-300 cursor-pointer"
        />
      </div>
    </div>
  </div>
);
