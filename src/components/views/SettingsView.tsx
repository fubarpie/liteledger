import React, { useState } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Tag,
  CreditCard,
  DollarSign,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Business, Account, Category } from '../../types.ts';

interface SettingsViewProps {
  onOpenAddBusiness: () => void;
}

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
    resetAllToDefaults,
  } = useAccounting();

  // Tab: 'entities', 'accounts', 'chart_of_accounts', 'backup'
  const [activeTab, setActiveTab] = useState<'entities' | 'accounts' | 'categories' | 'backup'>('entities');

  // Edit Business state
  const [editingBizId, setEditingBizId] = useState<string | null>(null);
  const [editBizForm, setEditBizForm] = useState<Partial<Business>>({});

  // Add Account Modal / inline form
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    type: 'checking' as Account['type'],
    institution: '',
    accountNumberLast4: '',
    currentBalance: 0,
  });

  // Add Category inline form
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [newCatForm, setNewCatForm] = useState({
    name: '',
    type: 'expense' as Category['type'],
    scheduleCLine: 'Line 27a: Other expenses',
    description: '',
    isTaxDeductible: true,
  });

  const handleStartEditBiz = (biz: Business) => {
    setEditingBizId(biz.id);
    setEditBizForm({ ...biz });
  };

  const handleSaveEditBiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBizId) return;
    updateBusiness(editingBizId, editBizForm);
    setEditingBizId(null);
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.name.trim()) return;

    addAccount({
      businessId: activeBusiness.id,
      name: newAccountForm.name.trim(),
      type: newAccountForm.type,
      institution: newAccountForm.institution.trim() || 'Bank',
      accountNumberLast4: newAccountForm.accountNumberLast4.trim() || '0000',
      currentBalance: parseFloat(newAccountForm.currentBalance as any) || 0,
      availableBalance: parseFloat(newAccountForm.currentBalance as any) || 0,
    });

    setNewAccountForm({
      name: '',
      type: 'checking',
      institution: '',
      accountNumberLast4: '',
      currentBalance: 0,
    });
    setShowAddAccountForm(false);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatForm.name.trim()) return;

    addCategory({
      name: newCatForm.name.trim(),
      type: newCatForm.type,
      scheduleCLine: newCatForm.scheduleCLine.trim(),
      description: newCatForm.description.trim() || undefined,
      isTaxDeductible: newCatForm.isTaxDeductible,
    });

    setNewCatForm({
      name: '',
      type: 'expense',
      scheduleCLine: 'Line 27a: Other expenses',
      description: '',
      isTaxDeductible: true,
    });
    setShowAddCategoryForm(false);
  };

  // Backup & Restore
  const handleExportFullBackup = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      kitebooks: {
        businesses: JSON.parse(localStorage.getItem('kitebooks_businesses_v1') || '[]'),
        accounts: JSON.parse(localStorage.getItem('kitebooks_accounts_v1') || '[]'),
        categories: JSON.parse(localStorage.getItem('kitebooks_categories_v1') || '[]'),
        transactions: JSON.parse(localStorage.getItem('kitebooks_transactions_v1') || '[]'),
        reconciliations: JSON.parse(localStorage.getItem('kitebooks_reconciliations_v1') || '[]'),
        bridgeConfigs: JSON.parse(localStorage.getItem('kitebooks_bridge_configs_v1') || '{}'),
      },
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KiteBooks_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeBusiness.currency || 'USD',
    }).format(val);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Settings & Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure business entities, bank & loan accounts, and IRS Chart of Accounts.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="p-1 bg-slate-100 rounded-lg flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('entities')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'entities'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Business Entities ({businesses.length})
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'accounts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bank & Card Accounts ({accounts.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chart of Accounts ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Backup & Reset
          </button>
        </div>
      </div>

      {/* Tab 1: Business Entities */}
      {activeTab === 'entities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Your Family Businesses</h2>
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
                          <span className="font-medium truncate">{biz.industry}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Fiscal Year End:</span>
                          <span className="font-medium">{biz.fiscalYearEnd}</span>
                        </div>
                      </div>

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
                              onClick={() => {
                                if (confirm(`Delete ${biz.name}? All its accounts and transactions will be removed.`)) {
                                  deleteBusiness(biz.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete business"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Edit Form */
                    <form onSubmit={handleSaveEditBiz} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Business Display Name
                        </label>
                        <input
                          type="text"
                          value={editBizForm.name || ''}
                          onChange={(e) =>
                            setEditBizForm({ ...editBizForm, name: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Legal Name
                        </label>
                        <input
                          type="text"
                          value={editBizForm.legalName || ''}
                          onChange={(e) =>
                            setEditBizForm({ ...editBizForm, legalName: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            EIN
                          </label>
                          <input
                            type="text"
                            value={editBizForm.ein || ''}
                            onChange={(e) =>
                              setEditBizForm({ ...editBizForm, ein: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Color
                          </label>
                          <input
                            type="color"
                            value={editBizForm.color || '#0f766e'}
                            onChange={(e) =>
                              setEditBizForm({ ...editBizForm, color: e.target.value })
                            }
                            className="w-full h-8 px-1 py-1 rounded border border-slate-300 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingBizId(null)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded shadow-xs"
                        >
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

      {/* Tab 2: Bank & Card Accounts */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Accounts for {activeBusiness.name}
              </h2>
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

          {/* Add Account Inline Form */}
          {showAddAccountForm && (
            <form
              onSubmit={handleCreateAccount}
              className="bg-white p-4 rounded-xl border border-teal-300 shadow-xs space-y-3 animate-in fade-in"
            >
              <h3 className="text-xs font-bold text-teal-900 uppercase">New Account Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={newAccountForm.name}
                    onChange={(e) =>
                      setNewAccountForm({ ...newAccountForm, name: e.target.value })
                    }
                    placeholder="e.g., Primary Business Checking"
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={newAccountForm.type}
                    onChange={(e) =>
                      setNewAccountForm({
                        ...newAccountForm,
                        type: e.target.value as Account['type'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white"
                  >
                    <option value="checking">Checking Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="credit_card">Business Credit Card</option>
                    <option value="loan">Equipment / Business Loan</option>
                    <option value="mortgage">Commercial Mortgage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Institution / Bank
                  </label>
                  <input
                    type="text"
                    value={newAccountForm.institution}
                    onChange={(e) =>
                      setNewAccountForm({ ...newAccountForm, institution: e.target.value })
                    }
                    placeholder="e.g., Chase, Wells Fargo"
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newAccountForm.accountNumberLast4}
                    onChange={(e) =>
                      setNewAccountForm({ ...newAccountForm, accountNumberLast4: e.target.value })
                    }
                    placeholder="1234"
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Initial Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccountForm.currentBalance}
                    onChange={(e) =>
                      setNewAccountForm({ ...newAccountForm, currentBalance: e.target.value as any })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded shadow-xs"
                >
                  Add Account
                </button>
              </div>
            </form>
          )}

          {/* Accounts List Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Last 4</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{acc.name}</td>
                    <td className="py-3 px-4 text-slate-600">{acc.institution}</td>
                    <td className="py-3 px-4 capitalize text-slate-600">
                      {acc.type.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      •••• {acc.accountNumberLast4}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(acc.currentBalance)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          if (confirm(`Delete account ${acc.name}?`)) {
                            deleteAccount(acc.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Chart of Accounts & Categories */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Chart of Accounts & Categories</h2>
              <p className="text-xs text-slate-500">
                Standard categories mapped to IRS Schedule C lines for automatic tax classification
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

          {/* Add Category Form */}
          {showAddCategoryForm && (
            <form
              onSubmit={handleCreateCategory}
              className="bg-white p-4 rounded-xl border border-teal-300 shadow-xs space-y-3 animate-in fade-in"
            >
              <h3 className="text-xs font-bold text-teal-900 uppercase">New Category Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={newCatForm.name}
                    onChange={(e) => setNewCatForm({ ...newCatForm, name: e.target.value })}
                    placeholder="e.g., Software Subscriptions"
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={newCatForm.type}
                    onChange={(e) =>
                      setNewCatForm({
                        ...newCatForm,
                        type: e.target.value as Category['type'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white"
                  >
                    <option value="expense">Operating Expense</option>
                    <option value="cogs">Cost of Goods Sold (COGS)</option>
                    <option value="income">Income / Revenue</option>
                    <option value="transfer">Transfer</option>
                    <option value="equity">Owner Equity / Draw</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    IRS Schedule C Line
                  </label>
                  <input
                    type="text"
                    value={newCatForm.scheduleCLine}
                    onChange={(e) =>
                      setNewCatForm({ ...newCatForm, scheduleCLine: e.target.value })
                    }
                    placeholder="e.g., Line 18: Office expense"
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded shadow-xs"
                >
                  Save Category
                </button>
              </div>
            </form>
          )}

          {/* Categories Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">IRS Schedule C Line Mapping</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Tax Deductible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{c.name}</td>
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
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                      {c.scheduleCLine}
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Backup & Reset */}
      {activeTab === 'backup' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Backup & Data Portability</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Export a complete JSON backup of all your businesses, accounts, categories,
              transactions, and reconciliations. You own your financial data.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleExportFullBackup}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-lg shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Full Backup (JSON)</span>
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-rose-900">Restore Sample Initial Data</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Want to reset everything back to the initial pre-loaded state with Ventling Woodworks
              LLC and Ventling Properties LLC? This will overwrite local changes.
            </p>

            <button
              onClick={() => {
                if (confirm('Are you sure you want to restore the default sample data?')) {
                  resetAllToDefaults();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Sample Financial Data</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
