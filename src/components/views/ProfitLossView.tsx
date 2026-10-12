import React, { useState, useMemo } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import {
  TrendingUp,
  TrendingDown,
  Printer,
  Download,
  Calendar,
  Filter,
  PieChart,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Category } from '../../types.ts';

export const ProfitLossView: React.FC = () => {
  const { activeBusiness, categories, transactions } = useAccounting();
  const safeCategories = categories || [];
  const safeTransactions = transactions || [];

  // Date helpers (local time, never UTC-shifted)
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toCents = (n: number) => Math.round((Number(n) || 0) * 100);

  // Fiscal year containing `ref`, from activeBusiness.fiscalYearEnd ('MM-DD')
  const fiscalYearRange = (ref: Date, offset = 0) => {
    const m = /^(\d{1,2})-(\d{1,2})$/.exec(activeBusiness?.fiscalYearEnd || '');
    let endMonth = m ? Number(m[1]) : 12;
    let endDay = m ? Number(m[2]) : 31;
    if (endMonth < 1 || endMonth > 12) { endMonth = 12; endDay = 31; }
    const lastDay = (y: number) => new Date(y, endMonth, 0).getDate();
    const endIn = (y: number) => new Date(y, endMonth - 1, Math.min(Math.max(endDay, 1), lastDay(y)));
    let endYear = ref.getFullYear();
    if (ref > endIn(endYear)) endYear += 1;
    endYear += offset;
    const end = endIn(endYear);
    const prevEnd = endIn(endYear - 1);
    const start = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() + 1);
    return { start, end };
  };

  const now = new Date();
  const initialFy = fiscalYearRange(now);
  const [periodPreset, setPeriodPreset] = useState<string>('ytd');
  const [startDate, setStartDate] = useState<string>(fmtDate(initialFy.start));
  const [endDate, setEndDate] = useState<string>(fmtDate(now));

  const handlePresetChange = (preset: string) => {
    setPeriodPreset(preset);
    const cur = new Date();
    const yr = cur.getFullYear();
    const mo = cur.getMonth();

    if (preset === 'this_month') {
      setStartDate(fmtDate(new Date(yr, mo, 1)));
      setEndDate(fmtDate(new Date(yr, mo + 1, 0)));
    } else if (preset === 'last_month') {
      setStartDate(fmtDate(new Date(yr, mo - 1, 1)));
      setEndDate(fmtDate(new Date(yr, mo, 0)));
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(mo / 3) * 3;
      setStartDate(fmtDate(new Date(yr, qMonth, 1)));
      setEndDate(fmtDate(new Date(yr, qMonth + 3, 0)));
    } else if (preset === 'ytd') {
      setStartDate(fmtDate(fiscalYearRange(cur).start));
      setEndDate(fmtDate(cur));
    } else if (preset === 'last_year') {
      const fy = fiscalYearRange(cur, -1);
      setStartDate(fmtDate(fy.start));
      setEndDate(fmtDate(fy.end));
    } else if (preset === 'all') {
      setStartDate('0000-01-01');
      setEndDate('9999-12-31');
    }
  };

  // Filter transactions within period
  const periodTransactions = useMemo(() => {
    return safeTransactions.filter(
      (t) => t.date >= startDate && t.date <= endDate
    );
  }, [safeTransactions, startDate, endDate]);

  // Group transactions by category ID (integer cents; transfers/equity never reach the P&L)
  const categoryTotalsCents = useMemo(() => {
    const map = new Map<string, number>();
    periodTransactions.forEach((t) => {
      if (t.categoryId) {
        map.set(t.categoryId, (map.get(t.categoryId) || 0) + toCents(t.amount));
      }
    });
    return map;
  }, [periodTransactions]);

  // Signed dollars per category: income = inflows - refunds, cogs/expense = outflows - refunds
  const amountFor = (c: Category) => {
    const cents = categoryTotalsCents.get(c.id) || 0;
    const v = c.type === 'income' ? cents : -cents;
    return (v === 0 ? 0 : v) / 100;
  };

  const incomeCategories = useMemo(() => safeCategories.filter((c) => c.type === 'income'), [safeCategories]);
  const cogsCategories = useMemo(() => safeCategories.filter((c) => c.type === 'cogs'), [safeCategories]);
  const expenseCategories = useMemo(() => safeCategories.filter((c) => c.type === 'expense'), [safeCategories]);

  const sumCents = (cats: Category[]) =>
    cats.reduce((sum, c) => sum + (c.type === 'income' ? 1 : -1) * (categoryTotalsCents.get(c.id) || 0), 0);
  const revenueC = sumCents(incomeCategories);
  const cogsC = sumCents(cogsCategories);
  const opexC = sumCents(expenseCategories);

  const totalRevenue = revenueC / 100;
  const totalCOGS = cogsC / 100;
  const grossProfit = (revenueC - cogsC) / 100;
  const grossMargin = revenueC > 0 ? ((revenueC - cogsC) / revenueC) * 100 : 0;
  const totalOperatingExpenses = opexC / 100;
  const netIncome = (revenueC - cogsC - opexC) / 100;
  const netMargin = revenueC > 0 ? ((revenueC - cogsC - opexC) / revenueC) * 100 : 0;

  // Uncategorized (no category, or category no longer exists) within period; excluded from totals
  const knownCategoryIds = useMemo(() => new Set(safeCategories.map((c) => c.id)), [safeCategories]);
  const uncategorizedTxs = periodTransactions.filter((t) => !t.categoryId || !knownCategoryIds.has(t.categoryId));
  const uncategorizedAmount = uncategorizedTxs.reduce((sum, t) => sum + toCents(t.amount), 0) / 100;
  const uncategorizedCount = uncategorizedTxs.length;
  const hasAnyCategories = safeCategories.some((c) => ['income', 'cogs', 'expense'].includes(c.type));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeBusiness?.currency || 'USD',
      minimumFractionDigits: 2,
    }).format(Number.isFinite(val) ? val : 0);
  };

  // CSV Export Handler
  const handleExportCsv = () => {
    const rows = [
      [`PROFIT & LOSS STATEMENT - ${activeBusiness.name}`],
      [`Period: ${startDate} to ${endDate}`],
      [`Accounting Method: Cash Basis`],
      [''],
      ['Category Name', 'IRS Schedule C Line', 'Amount (USD)'],
      ['--- REVENUE / INCOME ---', '', ''],
      ...incomeCategories.map((c) => [
        c.name,
        c.scheduleCLine,
        amountFor(c).toFixed(2),
      ]),
      ['TOTAL REVENUE', '', totalRevenue.toFixed(2)],
      [''],
      ['--- COST OF GOODS SOLD ---', '', ''],
      ...cogsCategories.map((c) => [
        c.name,
        c.scheduleCLine,
        amountFor(c).toFixed(2),
      ]),
      ['TOTAL COGS', '', totalCOGS.toFixed(2)],
      ['GROSS PROFIT', '', grossProfit.toFixed(2)],
      [''],
      ['--- OPERATING EXPENSES ---', '', ''],
      ...expenseCategories.map((c) => [
        c.name,
        c.scheduleCLine,
        amountFor(c).toFixed(2),
      ]),
      ['TOTAL OPERATING EXPENSES', '', totalOperatingExpenses.toFixed(2)],
      [''],
      ['NET PROFIT / LOSS', '', netIncome.toFixed(2)],
      [''],
      [`Uncategorized (${uncategorizedCount} txns, excluded from totals; net inflow)`, '', uncategorizedAmount.toFixed(2)],
    ];

    const esc = (cell: unknown) => {
      let v = String(cell ?? '');
      if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = "'" + v;
      return `"${v.replace(/"/g, '""')}"`;
    };
    const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const encodedUri = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Profit_Loss_${(activeBusiness?.name || 'business').replace(/[^A-Za-z0-9]+/g, '_')}_${periodPreset === 'all' ? 'all_time' : `${startDate}_to_${endDate}`}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(encodedUri), 1000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Filter and Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Profit & Loss Statement
            </h1>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Cash Basis
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Financial performance summary for {activeBusiness.name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Date Range Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'this_quarter', label: 'This Quarter' },
            { id: 'ytd', label: 'Year to Date' },
            { id: 'last_year', label: 'Last Year' },
            { id: 'all', label: 'All Time' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetChange(preset.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                periodPreset === preset.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Date pickers */}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPeriodPreset('custom');
            }}
            className="px-2 py-1 text-xs border border-slate-200 rounded-md font-mono"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPeriodPreset('custom');
            }}
            className="px-2 py-1 text-xs border border-slate-200 rounded-md font-mono"
          />
        </div>
      </div>

      {/* Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500">Total Revenue</div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Gross receipts & sales</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500">Cost of Goods Sold</div>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">
            {formatCurrency(totalCOGS)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Direct materials & labor</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500">Gross Profit</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {formatCurrency(grossProfit)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {grossMargin.toFixed(1)}% Gross Margin
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500">Net Profit / Loss</div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              netIncome >= 0 ? 'text-teal-700' : 'text-rose-600'
            }`}
          >
            {formatCurrency(netIncome)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {netMargin.toFixed(1)}% Net Margin
          </div>
        </div>
      </div>

      {/* Uncategorized Warning if any exist in period */}
      {uncategorizedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 flex items-center justify-between">
          <span>
            ⚠️ Notice: {uncategorizedCount} Uncategorized transaction{uncategorizedCount === 1 ? '' : 's'} (net{' '}
            {formatCurrency(uncategorizedAmount)}) in this date range are excluded from the report
            below. Categorize them for an accurate P&L.
          </span>
        </div>
      )}

      {!hasAnyCategories && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
          No income or expense categories exist for this business yet. Add categories and categorize
          transactions to populate this report.
        </div>
      )}

      {/* Printable Structured Statement */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Printable Statement Header */}
        <div className="p-6 border-b border-slate-200 text-center space-y-1">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {activeBusiness.legalName || activeBusiness.name}
          </h2>
          <div className="text-sm font-semibold text-slate-700">Statement of Profit & Loss</div>
          <div className="text-xs text-slate-500">
            {periodPreset === 'all' ? 'For all time' : `For the period ${startDate} to ${endDate}`}
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Section 1: Revenue / Income */}
          <div>
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-800 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <span>Operating Revenue & Gross Receipts</span>
              <span>Amount</span>
            </div>
            <div className="divide-y divide-slate-100">
              {incomeCategories.length === 0 && (
                <div className="py-2.5 text-xs text-slate-400 italic">No categories of this type</div>
              )}
              {incomeCategories.map((c) => {
                const amt = amountFor(c);
                return (
                  <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-slate-800">{c.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">({c.scheduleCLine})</span>
                    </div>
                    <span className="font-mono text-slate-900">{formatCurrency(amt)}</span>
                  </div>
                );
              })}
            </div>
            <div className="pt-2.5 border-t border-slate-300 flex items-center justify-between text-xs font-bold text-slate-900">
              <span>TOTAL OPERATING REVENUE</span>
              <span className="font-mono text-sm">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>

          {/* Section 2: Cost of Goods Sold */}
          <div>
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-800 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <span>Cost of Goods Sold (COGS)</span>
              <span>Amount</span>
            </div>
            <div className="divide-y divide-slate-100">
              {cogsCategories.length === 0 && (
                <div className="py-2.5 text-xs text-slate-400 italic">No categories of this type</div>
              )}
              {cogsCategories.map((c) => {
                const amt = amountFor(c);
                return (
                  <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-slate-800">{c.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">({c.scheduleCLine})</span>
                    </div>
                    <span className="font-mono text-slate-900">{formatCurrency(amt)}</span>
                  </div>
                );
              })}
            </div>
            <div className="pt-2.5 border-t border-slate-300 flex items-center justify-between text-xs font-bold text-slate-900">
              <span>TOTAL COST OF GOODS SOLD</span>
              <span className="font-mono text-sm">{formatCurrency(totalCOGS)}</span>
            </div>
          </div>

          {/* Gross Profit Subtotal */}
          <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-between text-xs font-bold text-slate-900 border border-slate-200">
            <div>
              <span className="text-sm">GROSS PROFIT</span>
              <span className="text-xs font-normal text-slate-500 ml-2">
                (Margin: {grossMargin.toFixed(1)}%)
              </span>
            </div>
            <span className="font-mono text-base">{formatCurrency(grossProfit)}</span>
          </div>

          {/* Section 3: Operating Expenses */}
          <div>
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-800 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <span>Operating Expenses</span>
              <span>Amount</span>
            </div>
            <div className="divide-y divide-slate-100">
              {expenseCategories.length === 0 && (
                <div className="py-2.5 text-xs text-slate-400 italic">No categories of this type</div>
              )}
              {expenseCategories.map((c) => {
                const amt = amountFor(c);
                return (
                  <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-slate-800">{c.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">({c.scheduleCLine})</span>
                    </div>
                    <span className="font-mono text-slate-900">{formatCurrency(amt)}</span>
                  </div>
                );
              })}
            </div>
            <div className="pt-2.5 border-t border-slate-300 flex items-center justify-between text-xs font-bold text-slate-900">
              <span>TOTAL OPERATING EXPENSES</span>
              <span className="font-mono text-sm">{formatCurrency(totalOperatingExpenses)}</span>
            </div>
          </div>

          {uncategorizedCount > 0 && (
            <div className="flex items-center justify-between text-xs px-1 text-amber-700">
              <span className="font-medium">⚠️ Uncategorized ({uncategorizedCount}) — not included above</span>
              <span className="font-mono">{formatCurrency(uncategorizedAmount)}</span>
            </div>
          )}

          {/* Final Bottom Line: Net Income */}
          <div
            className={`p-5 rounded-xl border-2 flex items-center justify-between ${
              netIncome >= 0
                ? 'bg-teal-50/50 border-teal-500 text-teal-950'
                : 'bg-rose-50/50 border-rose-500 text-rose-950'
            }`}
          >
            <div>
              <div className="text-base font-bold tracking-tight">NET OPERATING PROFIT / (LOSS)</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Cash Net Income for tax and business planning
              </div>
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                netIncome >= 0 ? 'text-teal-800' : 'text-rose-600'
              }`}
            >
              {formatCurrency(netIncome)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
