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
  Pencil,
  Lock,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Transaction, Category } from '../../types.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface TransactionsViewProps {
  onOpenAddTransaction: () => void;
  onOpenImportCsv: () => void;
  onOpenAiReview: () => void;
  /** Open the edit modal for a transaction. */
  onEditTransaction: (tx: Transaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onOpenAddTransaction,
  onOpenImportCsv,
  onOpenAiReview,
  onEditTransaction,
}) => {
  const { aiEnabled } = useAuth();
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
  const [aiError, setAiError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const selectedTxs = transactions.filter((t) => selectedTxIds.has(t.id));
  const selectedReconciledCount = selectedTxs.filter((t) => t.reconciled).length;

  const handleBatchDelete = () => {
    const deletable = selectedTxs.filter((t) => !t.reconciled);
    const skipped = selectedTxs.length - deletable.length;
    deletable.forEach((t) => deleteTransaction(t.id));
    setSelectedTxIds(new Set());
    setConfirmBulkDelete(false);
    setBulkMessage(
      `Deleted ${deletable.length} transaction${deletable.length === 1 ? '' : 's'}.` +
        (skipped ? ` Skipped ${skipped} reconciled transaction${skipped === 1 ? '' : 's'} (delete the reconciliation first).` : '')
    );
  };

  const runAi = async (ids?: string[]) => {
    setAiError(null);
    try {
      const res = await autoCategorizeWithAI(ids);
      if (res.suggestions.length > 0) onOpenAiReview();
      return res;
    } catch (e: any) {
      setAiError(e?.message || 'AI categorization failed.');
    }
  };

  const handleBatchAiCategorize = async () => {
    if (selectedTxIds.size === 0) return;
    await runAi(Array.from(selectedTxIds));
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
            View, manually categorize, or use AI to auto-classify bank and card transactions.
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
            onClick={() => runAi()}
            disabled={isAiCategorizing || uncategorizedCount === 0 || !aiEnabled}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            title={aiEnabled ? 'Automatically categorize uncategorized transactions with AI' : 'AI is not configured. Set OPENROUTER_API_KEY on the server to enable it.'}
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

      {!aiEnabled && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>AI categorization is off. Set <code className="font-mono">OPENROUTER_API_KEY</code> on the server and restart to enable it.</span>
        </div>
      )}
      {aiError && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="flex-1">
            {aiError}
            {/openrouter|not configured|api key/i.test(aiError) && (
              <> Set <code className="font-mono">OPENROUTER_API_KEY</code> on the server to enable AI.</>
            )}
          </span>
          <button onClick={() => setAiError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {bulkMessage && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-[11px] text-teal-900">
          <span className="flex-1">{bulkMessage}</span>
          <button onClick={() => setBulkMessage(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

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
              disabled={isAiCategorizing || !aiEnabled}
              title={aiEnabled ? undefined : 'AI is not configured (OPENROUTER_API_KEY)'}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Categorize Selected</span>
            </button>

            {confirmBulkDelete ? (
              <div className="flex items-center gap-2 px-2 py-1 bg-rose-50 border border-rose-300 rounded-lg text-rose-800">
                <span>
                  Delete {selectedTxs.length - selectedReconciledCount}?
                  {selectedReconciledCount > 0 && ` (${selectedReconciledCount} reconciled will be skipped)`}
                </span>
                <button onClick={handleBatchDelete} className="px-2 py-0.5 bg-rose-600 text-white rounded font-semibold">
                  Yes
                </button>
                <button onClick={() => setConfirmBulkDelete(false)} className="text-slate-600">
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmBulkDelete(true)}
                disabled={selectedTxs.length > 0 && selectedReconciledCount === selectedTxs.length}
                title={selectedReconciledCount === selectedTxs.length ? 'Reconciled transactions cannot be deleted' : undefined}
                className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg font-medium flex items-center gap-1 shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

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
                <th className="py-3 px-3 w-20 text-center">Actions</th>
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
                      onClick={() => onEditTransaction(tx)}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                        isSelected ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
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
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
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
                            title="Reconciled — date, amount and account are locked"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full bg-slate-200"
                            title="Pending Statement Reconciliation"
                          />
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {confirmDeleteId === tx.id ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px]">
                            <button
                              onClick={() => {
                                deleteTransaction(tx.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-1.5 py-0.5 bg-rose-600 text-white rounded font-semibold"
                            >
                              Delete
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-slate-500">
                              No
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => onEditTransaction(tx)}
                              className="p-1 text-slate-400 hover:text-teal-700 rounded transition-colors"
                              title="Edit Transaction"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(tx.id)}
                              disabled={tx.reconciled}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                              title={tx.reconciled ? 'Reconciled transactions cannot be deleted' : 'Delete Transaction'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
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
