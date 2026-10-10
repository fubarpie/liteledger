import React, { useState, useMemo, useEffect } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  History,
  Calendar,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  DollarSign,
  CreditCard,
  Building,
} from 'lucide-react';
import { Account, Transaction, Reconciliation } from '../../types.ts';

export const ReconciliationView: React.FC = () => {
  const {
    activeBusiness,
    accounts,
    transactions,
    reconciliations,
    saveReconciliation,
    deleteReconciliation,
  } = useAccounting();

  // Mode: 'new_reconciliation' or 'history'
  const [activeTab, setActiveTab] = useState<'reconcile' | 'history'>('reconcile');

  // Selected Account to reconcile
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ''
  );

  useEffect(() => {
    if (accounts.length > 0 && !accounts.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  }, [accounts, selectedAccountId]);

  // Find previous reconciliation for this account to pre-fill beginning balance
  const previousReconciliation = useMemo(() => {
    return reconciliations
      .filter((r) => r.accountId === selectedAccountId && r.status === 'reconciled')
      .sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime())[0];
  }, [reconciliations, selectedAccountId]);

  // Reconciliation form states
  const todayStr = new Date().toISOString().split('T')[0];
  const [statementDate, setStatementDate] = useState<string>(todayStr);
  const [beginningBalance, setBeginningBalance] = useState<number>(() => {
    return previousReconciliation ? previousReconciliation.statementEndingBalance : 0;
  });
  const [endingBalance, setEndingBalance] = useState<string>('0.00');
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');

  // Cleared transaction IDs
  const [clearedTxIds, setClearedTxIds] = useState<Set<string>>(new Set());

  // Reset form when account changes
  useEffect(() => {
    if (previousReconciliation) {
      setBeginningBalance(previousReconciliation.statementEndingBalance);
    } else {
      setBeginningBalance(0);
    }
    setClearedTxIds(new Set());
  }, [selectedAccountId, previousReconciliation]);

  // Eligible transactions for this account up to statement date
  const eligibleTransactions = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.accountId === selectedAccountId &&
        t.date <= statementDate &&
        (!t.reconciled || clearedTxIds.has(t.id))
    );
  }, [transactions, selectedAccountId, statementDate, clearedTxIds]);

  // Separate deposits (inflow > 0) and withdrawals (outflow < 0)
  const deposits = useMemo(() => {
    return eligibleTransactions.filter((t) => t.amount > 0);
  }, [eligibleTransactions]);

  const withdrawals = useMemo(() => {
    return eligibleTransactions.filter((t) => t.amount < 0);
  }, [eligibleTransactions]);

  // Math calculation of cleared balances
  const clearedDeposits = useMemo(() => {
    return deposits.filter((t) => clearedTxIds.has(t.id));
  }, [deposits, clearedTxIds]);

  const clearedWithdrawals = useMemo(() => {
    return withdrawals.filter((t) => clearedTxIds.has(t.id));
  }, [withdrawals, clearedTxIds]);

  const totalClearedDeposits = clearedDeposits.reduce((sum, t) => sum + t.amount, 0);
  const totalClearedWithdrawals = clearedWithdrawals.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0
  );

  // Cleared balance calculation
  // For standard checking/asset account: Beginning + Deposits - Withdrawals
  // For credit cards / liability: Same debit/credit mechanics
  const clearedBalance = beginningBalance + totalClearedDeposits - totalClearedWithdrawals;
  const parsedEndingBalance = parseFloat(endingBalance || '0') || 0;
  const difference = Number((clearedBalance - parsedEndingBalance).toFixed(2));
  const isBalanced = Math.abs(difference) < 0.009;

  // Toggle single item
  const handleToggleTx = (id: string) => {
    setClearedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle all deposits
  const handleToggleAllDeposits = () => {
    const allDepositIds = deposits.map((d) => d.id);
    const areAllSelected = allDepositIds.every((id) => clearedTxIds.has(id));

    setClearedTxIds((prev) => {
      const next = new Set(prev);
      allDepositIds.forEach((id) => {
        if (areAllSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  // Toggle all withdrawals
  const handleToggleAllWithdrawals = () => {
    const allWithdrawalIds = withdrawals.map((w) => w.id);
    const areAllSelected = allWithdrawalIds.every((id) => clearedTxIds.has(id));

    setClearedTxIds((prev) => {
      const next = new Set(prev);
      allWithdrawalIds.forEach((id) => {
        if (areAllSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  // Quick match target balance
  const handleAutoMatchStatement = () => {
    // Select all eligible transactions
    const allIds = eligibleTransactions.map((t) => t.id);
    setClearedTxIds(new Set(allIds));
  };

  // Finalize Reconciliation
  const handleFinalize = () => {
    if (!isBalanced) {
      if (
        !confirm(
          `Your statement has a difference of ${formatCurrency(
            difference
          )}. Do you still want to finalize this reconciliation?`
        )
      ) {
        return;
      }
    }

    const recRecord: Reconciliation = {
      id: `rec_${Date.now()}`,
      businessId: activeBusiness.id,
      accountId: selectedAccountId,
      statementDate,
      statementBeginningBalance: beginningBalance,
      statementEndingBalance: parsedEndingBalance,
      clearedDepositsCount: clearedDeposits.length,
      clearedDepositsTotal: totalClearedDeposits,
      clearedWithdrawalsCount: clearedWithdrawals.length,
      clearedWithdrawalsTotal: totalClearedWithdrawals,
      clearedBalance,
      difference,
      status: 'reconciled',
      reconciledAt: new Date().toISOString(),
      clearedTransactionIds: Array.from(clearedTxIds),
      notes: reconciliationNotes || undefined,
    };

    saveReconciliation(recRecord);
    alert('Reconciliation finalized and locked successfully!');
    setActiveTab('history');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeBusiness.currency || 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Account Selection */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Statement Reconciliation
            </h1>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Bank & Credit Card Audit
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile cleared deposits and withdrawals against your monthly physical or PDF bank
            statements.
          </p>
        </div>

        {/* Tab Controls: Reconcile vs History */}
        <div className="flex items-center gap-2">
          <div className="p-1 bg-slate-100 rounded-lg flex items-center gap-1">
            <button
              onClick={() => setActiveTab('reconcile')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'reconcile'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Statement
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reconciliation History ({reconciliations.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'reconcile' ? (
        <div className="space-y-6">
          {/* Step 1: Account & Statement Inputs */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-400">
              1. Statement Parameters
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Account Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account to Reconcile
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (•••• {a.accountNumberLast4}) - {formatCurrency(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Statement Ending Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Statement Ending Date
                </label>
                <input
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                />
              </div>

              {/* Statement Beginning Balance */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Beginning Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={beginningBalance}
                    onChange={(e) => setBeginningBalance(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
                {previousReconciliation && (
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Auto-filled from {previousReconciliation.statementDate}
                  </span>
                )}
              </div>

              {/* Statement Ending Balance */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Statement Ending Balance (from Paper/PDF)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={endingBalance}
                    onChange={(e) => setEndingBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Live Reconciliation Scorecard */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Math breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Beginning Balance</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-1">
                    {formatCurrency(beginningBalance)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    + Cleared Deposits ({clearedDeposits.length})
                  </div>
                  <div className="text-base font-bold font-mono text-emerald-700 mt-1">
                    +{formatCurrency(totalClearedDeposits)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-700 font-medium">
                    - Cleared Payments ({clearedWithdrawals.length})
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-1">
                    -{formatCurrency(totalClearedWithdrawals)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-medium">= Cleared Balance</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-1">
                    {formatCurrency(clearedBalance)}
                  </div>
                </div>
              </div>

              {/* Target & Difference indicator */}
              <div className="lg:border-l lg:border-slate-200 lg:pl-6 flex items-center justify-between lg:justify-end gap-6">
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Statement Target</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-1">
                    {formatCurrency(parsedEndingBalance)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Difference
                  </div>
                  <div
                    className={`text-2xl font-bold font-mono mt-0.5 ${
                      isBalanced ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatCurrency(difference)}
                  </div>
                </div>
              </div>
            </div>

            {/* In Balance Banner & Actions */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Difference is $0.00! Your account is balanced and ready to lock.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      Off by {formatCurrency(difference)}. Check off statement items below.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoMatchStatement}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Select All Eligible
                </button>
                <button
                  onClick={handleFinalize}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 ${
                    isBalanced
                      ? 'bg-teal-700 hover:bg-teal-800 text-white'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Finalize Reconciliation</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Cleared Items Checklist Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposits / Inflows */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-emerald-50/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Deposits & Credits ({deposits.length})
                  </h3>
                  <p className="text-[11px] text-emerald-800">
                    Cleared: {clearedDeposits.length} ({formatCurrency(totalClearedDeposits)})
                  </p>
                </div>
                <button
                  onClick={handleToggleAllDeposits}
                  className="text-xs font-medium text-emerald-800 hover:text-emerald-950 underline"
                >
                  Toggle All
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto flex-1">
                {deposits.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No uncleared deposits found on or before {statementDate}.
                  </div>
                ) : (
                  deposits.map((d) => {
                    const isChecked = clearedTxIds.has(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${
                          isChecked ? 'bg-emerald-50/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTx(d.id)}
                            className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {d.payee || d.description}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span>{d.date}</span>
                              {d.categoryName && <span>· {d.categoryName}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="font-mono font-bold text-xs text-emerald-700 flex-shrink-0 ml-3">
                          +{formatCurrency(d.amount)}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Payments / Withdrawals */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Payments, Checks & Charges ({withdrawals.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cleared: {clearedWithdrawals.length} ({formatCurrency(totalClearedWithdrawals)})
                  </p>
                </div>
                <button
                  onClick={handleToggleAllWithdrawals}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                >
                  Toggle All
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto flex-1">
                {withdrawals.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No uncleared payments found on or before {statementDate}.
                  </div>
                ) : (
                  withdrawals.map((w) => {
                    const isChecked = clearedTxIds.has(w.id);
                    return (
                      <label
                        key={w.id}
                        className={`p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${
                          isChecked ? 'bg-slate-100/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTx(w.id)}
                            className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {w.payee || w.description}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span>{w.date}</span>
                              {w.categoryName && <span>· {w.categoryName}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="font-mono font-bold text-xs text-slate-900 flex-shrink-0 ml-3">
                          {formatCurrency(Math.abs(w.amount))}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Reconciliation History Tab */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">
              Completed Reconciliations Audit Trail
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical statements reconciled and verified for {activeBusiness.name}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Statement Date</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4 text-right">Beginning Balance</th>
                  <th className="py-3 px-4 text-right">Ending Balance</th>
                  <th className="py-3 px-4 text-center">Cleared Items</th>
                  <th className="py-3 px-4">Reconciled On</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No reconciled statements found for this business yet.
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((rec) => {
                    const acc = accounts.find((a) => a.id === rec.accountId);
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          {rec.statementDate}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {acc?.name || 'Account'} (•••• {acc?.accountNumberLast4 || '0000'})
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatCurrency(rec.statementBeginningBalance)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(rec.statementEndingBalance)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium text-[11px]">
                            {rec.clearedTransactionIds.length} items
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {rec.reconciledAt
                            ? new Date(rec.reconciledAt).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                          {rec.notes || '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              if (confirm('Delete this reconciliation? This will unmark associated transactions.')) {
                                deleteReconciliation(rec.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Delete reconciliation record"
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
      )}
    </div>
  );
};
