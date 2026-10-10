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

  // Date Presets
  const [periodPreset, setPeriodPreset] = useState<string>('ytd');
  const now = new Date();
  const currentYear = now.getFullYear();

  // Custom date range
  const [startDate, setStartDate] = useState<string>(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState<string>(now.toISOString().split('T')[0]);

  const handlePresetChange = (preset: string) => {
    setPeriodPreset(preset);
    const yr = now.getFullYear();
    const mo = now.getMonth();

    if (preset === 'this_month') {
      const start = new Date(yr, mo, 1).toISOString().split('T')[0];
      const end = new Date(yr, mo + 1, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'last_month') {
      const start = new Date(yr, mo - 1, 1).toISOString().split('T')[0];
      const end = new Date(yr, mo, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(mo / 3) * 3;
      const start = new Date(yr, qMonth, 1).toISOString().split('T')[0];
      const end = new Date(yr, qMonth + 3, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'ytd') {
      setStartDate(`${yr}-01-01`);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'last_year') {
      setStartDate(`${yr - 1}-01-01`);
      setEndDate(`${yr - 1}-12-31`);
    } else if (preset === 'all') {
      setStartDate('2020-01-01');
      setEndDate('2030-12-31');
    }
  };

  // Filter transactions within period
  const periodTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.date >= startDate && t.date <= endDate
    );
  }, [transactions, startDate, endDate]);

  // Group transactions by category ID
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    periodTransactions.forEach((t) => {
      if (t.categoryId) {
        const cur = map.get(t.categoryId) || 0;
        map.set(t.categoryId, cur + t.amount);
      }
    });
    return map;
  }, [periodTransactions]);

  // Categories segregated by type
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income'),
    [categories]
  );
  const cogsCategories = useMemo(
    () => categories.filter((c) => c.type === 'cogs'),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  // Totals
  const totalRevenue = incomeCategories.reduce((sum, c) => {
    const amt = categoryTotals.get(c.id) || 0;
    return sum + (amt > 0 ? amt : 0);
  }, 0);

  const totalCOGS = cogsCategories.reduce((sum, c) => {
    const amt = categoryTotals.get(c.id) || 0;
    return sum + Math.abs(amt);
  }, 0);

  const grossProfit = totalRevenue - totalCOGS;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const totalOperatingExpenses = expenseCategories.reduce((sum, c) => {
    const amt = categoryTotals.get(c.id) || 0;
    return sum + Math.abs(amt);
  }, 0);

  const netIncome = grossProfit - totalOperatingExpenses;
  const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  // Uncategorized total within period
  const uncategorizedAmount = periodTransactions
    .filter((t) => !t.categoryId)
    .reduce((sum, t) => sum + t.amount, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeBusiness.currency || 'USD',
      minimumFractionDigits: 2,
    }).format(val);
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
        (categoryTotals.get(c.id) || 0).toFixed(2),
      ]),
      ['TOTAL REVENUE', '', totalRevenue.toFixed(2)],
      [''],
      ['--- COST OF GOODS SOLD ---', '', ''],
      ...cogsCategories.map((c) => [
        c.name,
        c.scheduleCLine,
        Math.abs(categoryTotals.get(c.id) || 0).toFixed(2),
      ]),
      ['TOTAL COGS', '', totalCOGS.toFixed(2)],
      ['GROSS PROFIT', '', grossProfit.toFixed(2)],
      [''],
      ['--- OPERATING EXPENSES ---', '', ''],
      ...expenseCategories.map((c) => [
        c.name,
        c.scheduleCLine,
        Math.abs(categoryTotals.get(c.id) || 0).toFixed(2),
      ]),
      ['TOTAL OPERATING EXPENSES', '', totalOperatingExpenses.toFixed(2)],
      [''],
      ['NET PROFIT / LOSS', '', netIncome.toFixed(2)],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Profit_Loss_${activeBusiness.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      {Math.abs(uncategorizedAmount) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 flex items-center justify-between">
          <span>
            ⚠️ Notice: You have transactions totaling {formatCurrency(uncategorizedAmount)} that
            are currently uncategorized in this date range. They are excluded from the report
            below.
          </span>
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
            For the period {startDate} to {endDate}
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
              {incomeCategories.map((c) => {
                const amt = categoryTotals.get(c.id) || 0;
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
              {cogsCategories.map((c) => {
                const amt = Math.abs(categoryTotals.get(c.id) || 0);
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
              {expenseCategories.map((c) => {
                const amt = Math.abs(categoryTotals.get(c.id) || 0);
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
