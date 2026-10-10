import React from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Building,
  Sparkles,
  ArrowRight,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  FileCheck2,
  PieChart,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenAddTransaction: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenAddTransaction,
}) => {
  const {
    activeBusiness,
    accounts,
    transactions,
    reconciliations,
    bridgeConfig,
    syncSimpleFin,
    isSyncing,
    autoCategorizeWithAI,
    isAiCategorizing,
  } = useAccounting();

  // Metrics calculation
  const cashAccounts = accounts.filter(
    (a) => a.type === 'checking' || a.type === 'savings'
  );
  const totalCash = cashAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const liabilityAccounts = accounts.filter(
    (a) => a.type === 'credit_card' || a.type === 'loan' || a.type === 'mortgage'
  );
  const totalLiabilities = liabilityAccounts.reduce(
    (sum, a) => sum + Math.abs(a.currentBalance || 0),
    0
  );

  const netLiquid = totalCash - liabilityAccounts
    .filter((a) => a.type === 'credit_card')
    .reduce((sum, a) => sum + Math.abs(a.currentBalance || 0), 0);

  // Current year/month income & expense
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthTransactions = transactions.filter((t) =>
    t.date.startsWith(currentMonthPrefix)
  );

  const monthRevenue = currentMonthTransactions
    .filter((t) => t.amount > 0 && t.categoryId?.startsWith('inc_'))
    .reduce((sum, t) => sum + t.amount, 0);

  const monthExpenses = currentMonthTransactions
    .filter((t) => t.amount < 0 && (t.categoryId?.startsWith('exp_') || t.categoryId?.startsWith('cogs_')))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const monthNetProfit = monthRevenue - monthExpenses;

  const uncategorizedTransactions = transactions.filter((t) => !t.categoryId);
  const unreconciledTransactions = transactions.filter((t) => !t.reconciled);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeBusiness.currency || 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Entity Greeting & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: activeBusiness.color || '#0f766e' }}
            />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeBusiness.name}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeBusiness.legalName} · {activeBusiness.structure} · Fiscal Year End{' '}
            {activeBusiness.fiscalYearEnd}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onOpenAddTransaction}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            + Add Transaction
          </button>
          <button
            onClick={() => onNavigateTab('bank-feeds')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Bank Feeds</span>
          </button>
          <button
            onClick={() => onNavigateTab('reconcile')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Reconcile Accounts</span>
          </button>
        </div>
      </div>

      {/* Action Need Alerts */}
      {uncategorizedTransactions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-900">
                {uncategorizedTransactions.length} Uncategorized Bank Transactions
              </div>
              <div className="text-xs text-amber-700">
                Categorize your income and expenses to ensure accurate P&L and tax deductions.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => autoCategorizeWithAI().catch(() => {})}
              disabled={isAiCategorizing}
              className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAiCategorizing ? 'Categorizing...' : 'AI Auto-Categorize All'}</span>
            </button>
            <button
              onClick={() => onNavigateTab('transactions')}
              className="px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 rounded-lg transition-colors"
            >
              Review in Register
            </button>
          </div>
        </div>
      )}

      {/* Financial Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Cash Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Operating Cash</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatCurrency(totalCash)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across {cashAccounts.length} checking & savings accounts
          </div>
        </div>

        {/* Credit & Liabilities */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Credit Cards & Debt</span>
            <CreditCard className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatCurrency(totalLiabilities)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {liabilityAccounts.length} cards, loans & mortgages
          </div>
        </div>

        {/* Current Month Revenue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Revenue (Month-to-Date)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-2">
            {formatCurrency(monthRevenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Sales, client retainers & service fees
          </div>
        </div>

        {/* Current Month Net Income */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Net Profit (Month-to-Date)</span>
            {monthNetProfit >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              monthNetProfit >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}
          >
            {formatCurrency(monthNetProfit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Expenses: {formatCurrency(monthExpenses)}
          </div>
        </div>
      </div>

      {/* Main Grid: Accounts List & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Connected Bank Accounts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Bank & Credit Card Accounts
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connected via SimpleFIN Bridge or recorded manually
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('bank-feeds')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                <span>Manage Feeds</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {accounts.map((acc) => {
                const isPositive = acc.currentBalance >= 0;
                return (
                  <div
                    key={acc.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        {acc.type === 'checking' || acc.type === 'savings' ? (
                          <DollarSign className="w-4 h-4 text-teal-700" />
                        ) : acc.type === 'credit_card' ? (
                          <CreditCard className="w-4 h-4 text-indigo-700" />
                        ) : (
                          <Building className="w-4 h-4 text-amber-700" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>{acc.name}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            •••• {acc.accountNumberLast4}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {acc.institution} ·{' '}
                          <span className="capitalize">{acc.type.replace('_', ' ')}</span>
                          {acc.simplefinAccountId && (
                            <span className="text-teal-700 font-medium ml-1.5">
                              · SimpleFIN Live
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-sm font-bold font-mono ${
                          acc.type === 'credit_card' || acc.type === 'loan' || acc.type === 'mortgage'
                            ? 'text-slate-800'
                            : isPositive
                            ? 'text-slate-900'
                            : 'text-rose-600'
                        }`}
                      >
                        {formatCurrency(acc.currentBalance)}
                      </div>
                      <button
                        onClick={() => onNavigateTab('reconcile')}
                        className="text-[11px] text-teal-700 hover:text-teal-800 font-medium mt-0.5 inline-block"
                      >
                        Reconcile Statement
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Recent Transactions</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest activity across your accounts
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('transactions')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                <span>View All ({transactions.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {transactions.slice(0, 6).map((tx) => {
                const isIncome = tx.amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xs text-slate-400 font-mono flex-shrink-0 w-16">
                        {tx.date.substring(5)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {tx.payee || tx.description}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                          {tx.categoryName ? (
                            <span className="text-slate-600">{tx.categoryName}</span>
                          ) : (
                            <span className="text-amber-700 font-medium">Uncategorized</span>
                          )}
                          {tx.reconciled && (
                            <span className="text-emerald-700 font-medium flex items-center gap-0.5">
                              · <CheckCircle className="w-3 h-3" /> Reconciled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-3">
                      <span
                        className={`text-xs font-bold font-mono ${
                          isIncome ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {isIncome ? '+' : ''}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Status & Bookkeeping Health */}
        <div className="space-y-6">
          {/* Bookkeeping Health Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Bookkeeping Checklist</h3>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                {uncategorizedTransactions.length === 0 ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <div className="text-xs font-medium text-slate-900">
                    Transaction Categorization
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {uncategorizedTransactions.length === 0
                      ? 'All transactions categorized!'
                      : `${uncategorizedTransactions.length} pending review.`}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                {reconciliations.length > 0 ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <div className="text-xs font-medium text-slate-900">
                    Statement Reconciliation
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {reconciliations.length > 0
                      ? `Last reconciled: ${reconciliations[0].statementDate}`
                      : 'No statements reconciled yet'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-slate-900">
                    Schedule C Tax Alignment
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Chart of accounts mapped directly to IRS Schedule C lines.
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Need CPA Export?</span>
              <button
                onClick={() => onNavigateTab('tax-export')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                Go to Tax Exports →
              </button>
            </div>
          </div>

          {/* SimpleFIN Status Widget */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">SimpleFIN Bridge</h3>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  bridgeConfig.status === 'connected'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {bridgeConfig.status === 'connected' ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              SimpleFIN securely synchronizes your bank accounts, credit cards, and mortgage
              feeds directly without expensive monthly fees.
            </p>

            {bridgeConfig.lastSyncedAt && (
              <div className="text-[11px] text-slate-400">
                Last synced:{' '}
                {new Date(bridgeConfig.lastSyncedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
            )}

            <button
              onClick={() => onNavigateTab('bank-feeds')}
              className="w-full py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors text-center"
            >
              Configure SimpleFIN Feeds
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
