import React, { useState, useMemo } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import {
  Search,
  Filter,
  Sparkles,
  Plus,
  Upload,
  CheckCircle2,
  Trash2,
  Tag,
  HelpCircle,
  Check,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Transaction, Category } from '../../types.ts';

interface TransactionsViewProps {
  onOpenAddTransaction: () => void;
  onOpenImportCsv: () => void;
  onOpenAiReview: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onOpenAddTransaction,
  onOpenImportCsv,
  onOpenAiReview,
}) => {
  const {
    activeBusiness,
    accounts,
    categories,
    transactions,
    categorizeTransaction,
    batchCategorizeTransactions,
    deleteTransaction,
    autoCategorizeWithAI,
    isAiCategorizing,
  } = useAccounting();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [reconciliationFilter, setReconciliationFilter] = useState<'all' | 'reconciled' | 'unreconciled'>('all');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [batchCategoryModalOpen, setBatchCategoryModalOpen] = useState(false);
  const [activeAiExplainTx, setActiveAiExplainTx] = useState<Transaction | null>(null);

  // Group categories by type
  const groupedCategories = useMemo(() => {
    const income = categories.filter((c) => c.type === 'income');
    const cogs = categories.filter((c) => c.type === 'cogs');
    const expense = categories.filter((c) => c.type === 'expense');
    const other = categories.filter((c) => c.type === 'transfer' || c.type === 'equity');
    return { income, cogs, expense, other };
  }, [categories]);

  // Account map for quick lookup
  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Account filter
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) {
        return false;
      }

      // Category filter
      if (selectedCategoryId === 'uncategorized' && tx.categoryId) {
        return false;
      }
      if (
        selectedCategoryId !== 'all' &&
        selectedCategoryId !== 'uncategorized' &&
        tx.categoryId !== selectedCategoryId
      ) {
        return false;
      }

      // Reconciliation filter
      if (reconciliationFilter === 'reconciled' && !tx.reconciled) return false;
      if (reconciliationFilter === 'unreconciled' && tx.reconciled) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesPayee = (tx.payee || '').toLowerCase().includes(query);
        const matchesDesc = (tx.description || '').toLowerCase().includes(query);
        const matchesNotes = (tx.notes || '').toLowerCase().includes(query);
        const matchesCategory = (tx.categoryName || '').toLowerCase().includes(query);
        const matchesAmount = tx.amount.toString().includes(query);
        if (!matchesPayee && !matchesDesc && !matchesNotes && !matchesCategory && !matchesAmount) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedAccountId, selectedCategoryId, reconciliationFilter, searchTerm]);

  const uncategorizedCount = transactions.filter((t) => !t.categoryId).length;

  const handleToggleSelect = (id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  const handleBatchCategorize = (catId: string) => {
    if (selectedTxIds.size === 0) return;
    batchCategorizeTransactions(Array.from(selectedTxIds), catId);
    setSelectedTxIds(new Set());
    setBatchCategoryModalOpen(false);
  };

  const handleBatchDelete = () => {
    if (selectedTxIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedTxIds.size} transactions?`)) {
      selectedTxIds.forEach((id) => deleteTransaction(id));
      setSelectedTxIds(new Set());
    }
  };

  const handleBatchAiCategorize = async () => {
    if (selectedTxIds.size === 0) return;
    const targetIds = Array.from(selectedTxIds);
    await autoCategorizeWithAI(targetIds);
    setSelectedTxIds(new Set());
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeBusiness.currency || 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Transactions</h1>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {transactions.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            View, manually categorize, or use Gemini AI to auto-classify bank and card transactions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenImportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV Statement</span>
          </button>

          <button
            onClick={onOpenAddTransaction}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Transaction</span>
          </button>

          <button
            onClick={() => {
              autoCategorizeWithAI()
                .then((res) => {
                  if (res.suggestions.length > 0) onOpenAiReview();
                })
                .catch(() => {});
            }}
            disabled={isAiCategorizing || uncategorizedCount === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            title="Automatically categorize uncategorized transactions with Gemini"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiCategorizing ? 'animate-spin' : ''}`} />
            <span>
              {isAiCategorizing ? 'Analyzing with AI...' : `AI Auto-Categorize (${uncategorizedCount})`}
            </span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search payee, description, memo..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Accounts ({accounts.length})</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (•••• {a.accountNumberLast4})
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Categories</option>
            <option value="uncategorized">⚠️ Uncategorized Only ({uncategorizedCount})</option>
            <optgroup label="Income">
              {groupedCategories.income.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cost of Goods Sold">
              {groupedCategories.cogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Operating Expenses">
              {groupedCategories.expense.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Other / Equity / Transfers">
              {groupedCategories.other.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </select>

          {/* Reconciliation Status Filter */}
          <select
            value={reconciliationFilter}
            onChange={(e) => setReconciliationFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Statuses</option>
            <option value="reconciled">✓ Reconciled</option>
            <option value="unreconciled">Pending Reconciliation</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 flex-shrink-0">
          Showing {filteredTransactions.length} of {transactions.length}
        </div>
      </div>

      {/* Batch Action Strip (Shown when rows selected) */}
      {selectedTxIds.size > 0 && (
        <div className="bg-teal-50 border border-teal-200 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs text-teal-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <span className="bg-teal-600 text-white font-bold px-2 py-0.5 rounded-md text-[11px]">
              {selectedTxIds.size}
            </span>
            <span>transactions selected</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setBatchCategoryModalOpen(!batchCategoryModalOpen)}
                className="px-3 py-1.5 bg-white border border-teal-300 hover:bg-teal-100/50 rounded-lg font-medium text-teal-800 flex items-center gap-1.5 shadow-xs"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Assign Category</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {batchCategoryModalOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setBatchCategoryModalOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 max-h-72 overflow-y-auto">
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase">
                      Select Category
                    </div>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleBatchCategorize(c.id)}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{c.type}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleBatchAiCategorize}
              disabled={isAiCategorizing}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Categorize Selected</span>
            </button>

            <button
              onClick={handleBatchDelete}
              className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg font-medium flex items-center gap-1 shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={() => setSelectedTxIds(new Set())}
              className="px-2 py-1 text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Transactions Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredTransactions.length > 0 &&
                      selectedTxIds.size === filteredTransactions.length
                    }
                    onChange={handleSelectAll}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-24">Date</th>
                <th className="py-3 px-3 w-40">Account</th>
                <th className="py-3 px-3">Payee & Description</th>
                <th className="py-3 px-3 w-64">Category & Tax Mapping</th>
                <th className="py-3 px-3 w-32 text-right">Amount</th>
                <th className="py-3 px-3 w-20 text-center">Reconciled</th>
                <th className="py-3 px-3 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="font-medium text-slate-600">No transactions found</p>
                    <p className="text-xs mt-1">
                      Try clearing filters, sync via SimpleFIN, or add transactions manually.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isIncome = tx.amount > 0;
                  const acc = accountMap.get(tx.accountId);
                  const isSelected = selectedTxIds.has(tx.id);

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(tx.id)}
                          className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {tx.date}
                      </td>

                      {/* Account */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800 truncate max-w-[150px]">
                          {acc?.name || 'Account'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          •••• {acc?.accountNumberLast4 || '0000'}
                        </div>
                      </td>

                      {/* Payee / Description */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 truncate max-w-[280px]">
                          {tx.payee || tx.description}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[280px]">
                          {tx.description}
                        </div>
                        {tx.notes && (
                          <div className="text-[10px] text-teal-700 italic mt-0.5">
                            Note: {tx.notes}
                          </div>
                        )}
                        {tx.aiReasoning && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-teal-800 bg-teal-50/80 px-1.5 py-0.5 rounded mt-1">
                            <Sparkles className="w-2.5 h-2.5 text-teal-600" />
                            <span>AI: {tx.aiReasoning}</span>
                          </div>
                        )}
                      </td>

                      {/* Category Selector */}
                      <td className="py-3 px-3">
                        <div className="relative">
                          <select
                            value={tx.categoryId || ''}
                            onChange={(e) =>
                              categorizeTransaction(tx.id, e.target.value ? e.target.value : null)
                            }
                            className={`w-full py-1.5 px-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors ${
                              !tx.categoryId
                                ? 'border-amber-300 bg-amber-50/60 text-amber-900 font-medium'
                                : 'border-slate-200 bg-white text-slate-800'
                            }`}
                          >
                            <option value="">⚠️ Select Category (Uncategorized)</option>
                            <optgroup label="Income">
                              {groupedCategories.income.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Cost of Goods Sold">
                              {groupedCategories.cogs.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Operating Expenses">
                              {groupedCategories.expense.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Other / Equity / Transfers">
                              {groupedCategories.other.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                        {tx.scheduleCLine && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[240px]">
                            {tx.scheduleCLine}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isIncome ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {isIncome ? '+' : ''}
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>

                      {/* Reconciled */}
                      <td className="py-3 px-3 text-center">
                        {tx.reconciled ? (
                          <span
                            className="inline-flex items-center justify-center text-emerald-600"
                            title="Reconciled with Bank Statement"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        ) : (
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full bg-slate-200"
                            title="Pending Statement Reconciliation"
                          />
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            if (confirm('Delete this transaction?')) {
                              deleteTransaction(tx.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete Transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
