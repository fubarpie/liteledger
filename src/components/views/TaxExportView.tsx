import React, { useState, useMemo } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import {
  FileSpreadsheet,
  Download,
  Printer,
  FileText,
  Building,
  CheckCircle2,
  AlertTriangle,
  FolderArchive,
  Info,
} from 'lucide-react';

export const TaxExportView: React.FC = () => {
  const { activeBusiness, categories, transactions, accounts } = useAccounting();

  const currentYear = new Date().getFullYear();
  const [selectedTaxYear, setSelectedTaxYear] = useState<number>(currentYear);

  const yearStartDate = `${selectedTaxYear}-01-01`;
  const yearEndDate = `${selectedTaxYear}-12-31`;

  // Transactions for the tax year
  const yearTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.date >= yearStartDate && t.date <= yearEndDate
    );
  }, [transactions, yearStartDate, yearEndDate]);

  // Account map
  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  // Map transactions by category
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    yearTransactions.forEach((t) => {
      if (t.categoryId) {
        const cur = map.get(t.categoryId) || 0;
        map.set(t.categoryId, cur + t.amount);
      }
    });
    return map;
  }, [yearTransactions]);

  // Group by Schedule C Tax Line
  const scheduleCLines = useMemo(() => {
    const lines: Record<
      string,
      {
        lineName: string;
        categories: { name: string; amount: number }[];
        totalAmount: number;
        note?: string;
      }
    > = {};

    categories.forEach((cat) => {
      const lineKey = cat.scheduleCLine || 'Other Expenses';
      const rawAmt = categoryTotals.get(cat.id) || 0;
      if (rawAmt === 0) return;

      const amt = cat.type === 'income' ? rawAmt : Math.abs(rawAmt);

      if (!lines[lineKey]) {
        lines[lineKey] = {
          lineName: lineKey,
          categories: [],
          totalAmount: 0,
        };
      }

      lines[lineKey].categories.push({ name: cat.name, amount: amt });
      lines[lineKey].totalAmount += amt;
    });

    return Object.values(lines).sort((a, b) => a.lineName.localeCompare(b.lineName));
  }, [categories, categoryTotals]);

  // Specific tax totals
  const grossSales = categories
    .filter((c) => c.type === 'income')
    .reduce((sum, c) => sum + (categoryTotals.get(c.id) || 0), 0);

  const cogsTotal = categories
    .filter((c) => c.type === 'cogs')
    .reduce((sum, c) => sum + Math.abs(categoryTotals.get(c.id) || 0), 0);

  const grossProfit = grossSales - cogsTotal;

  const totalDeductibleExpenses = categories
    .filter((c) => c.type === 'expense')
    .reduce((sum, c) => {
      let amt = Math.abs(categoryTotals.get(c.id) || 0);
      // IRS 50% rule for business meals
      if (c.id === 'exp_meals') {
        amt = amt * 0.5;
      }
      return sum + amt;
    }, 0);

  const estimatedScheduleCNet = grossProfit - totalDeductibleExpenses;

  const uncategorizedCount = yearTransactions.filter((t) => !t.categoryId).length;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeBusiness.currency || 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  // Export 1: Schedule C Summary CSV
  const handleExportScheduleCCsv = () => {
    const rows = [
      [`TAX PREPARATION REPORT - SCHEDULE C (FORM 1040)`],
      [`Tax Year: ${selectedTaxYear}`],
      [`Business Entity: ${activeBusiness.name}`],
      [`Legal Name: ${activeBusiness.legalName}`],
      [`EIN / Tax ID: ${activeBusiness.ein}`],
      [`Accounting Method: Cash Basis`],
      [''],
      ['IRS Schedule C Line', 'Category Component', 'Amount (USD)', 'Tax Notes'],
      ...scheduleCLines.flatMap((line) =>
        line.categories.map((c, i) => [
          i === 0 ? line.lineName : '',
          c.name,
          c.amount.toFixed(2),
          line.lineName.includes('Meals') ? '50% Deductible Limitation Applies' : '',
        ])
      ),
      [''],
      ['SUMMARY TOTALS', '', '', ''],
      ['Gross Receipts (Line 1)', '', grossSales.toFixed(2), ''],
      ['Cost of Goods Sold (Line 4)', '', cogsTotal.toFixed(2), ''],
      ['Gross Profit', '', grossProfit.toFixed(2), ''],
      ['Total Deductible Expenses (with 50% meal limit)', '', totalDeductibleExpenses.toFixed(2), ''],
      ['Net Business Profit / Loss', '', estimatedScheduleCNet.toFixed(2), ''],
    ];

    downloadCsv(
      rows,
      `Schedule_C_Tax_Summary_${activeBusiness.name.replace(/\s+/g, '_')}_${selectedTaxYear}.csv`
    );
  };

  // Export 2: General Ledger All Transactions Journal
  const handleExportJournalCsv = () => {
    const rows = [
      [`GENERAL LEDGER TRANSACTION JOURNAL`],
      [`Tax Year: ${selectedTaxYear} (${yearStartDate} to ${yearEndDate})`],
      [`Business: ${activeBusiness.name} (EIN: ${activeBusiness.ein})`],
      [''],
      [
        'Date',
        'Account',
        'Payee / Merchant',
        'Description',
        'Category',
        'IRS Schedule C Line',
        'Type',
        'Amount (USD)',
        'Reconciled Status',
        'Notes',
      ],
      ...yearTransactions.map((t) => {
        const acc = accountMap.get(t.accountId);
        return [
          t.date,
          acc ? `${acc.name} (•••• ${acc.accountNumberLast4})` : 'Account',
          t.payee || '',
          t.description || '',
          t.categoryName || 'Uncategorized',
          t.scheduleCLine || '',
          t.amount > 0 ? 'Income/Deposit' : 'Expense/Charge',
          t.amount.toFixed(2),
          t.reconciled ? 'Reconciled' : 'Pending',
          t.notes || '',
        ];
      }),
    ];

    downloadCsv(
      rows,
      `General_Ledger_Journal_${activeBusiness.name.replace(/\s+/g, '_')}_${selectedTaxYear}.csv`
    );
  };

  // Export 3: Complete Tax Package
  const handleDownloadTaxPackage = () => {
    handleExportScheduleCCsv();
    setTimeout(() => {
      handleExportJournalCsv();
    }, 400);
  };

  const downloadCsv = (rows: string[][], filename: string) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((r) => r.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Tax Professional & CPA Export
            </h1>
            <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              IRS Schedule C Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pull clean, structured financial packages designed for your accountant, tax preparer,
            or tax software.
          </p>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700">Tax Year:</label>
          <select
            value={selectedTaxYear}
            onChange={(e) => setSelectedTaxYear(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 text-xs font-bold font-mono rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tax Alert if Uncategorized */}
      {uncategorizedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-bold">
              Warning: You have {uncategorizedCount} uncategorized transactions in {selectedTaxYear}.
            </span>{' '}
            For full tax deductibility and accurate reporting, run AI Auto-Categorize or manually
            classify all transactions before handing data to your CPA.
          </div>
        </div>
      )}

      {/* 3 Main Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Schedule C Summary */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Schedule C Tax Summary</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Totals grouped line-by-line according to IRS Form 1040 Schedule C (Gross receipts,
              COGS, vehicle, contract labor, meals).
            </p>
          </div>
          <button
            onClick={handleExportScheduleCCsv}
            className="w-full py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Schedule C (CSV)</span>
          </button>
        </div>

        {/* Card 2: General Ledger Journal */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">General Ledger Journal</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every transaction with dates, accounts, payees, tax category mapping, amounts, and
              reconciliation verification flags.
            </p>
          </div>
          <button
            onClick={handleExportJournalCsv}
            className="w-full py-2 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download General Ledger (CSV)</span>
          </button>
        </div>

        {/* Card 3: Complete CPA Bundle */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <FolderArchive className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Complete Tax Prep Package</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              One-click download of both the Schedule C tax summary and the full transaction ledger
              for your CPA.
            </p>
          </div>
          <button
            onClick={handleDownloadTaxPackage}
            className="w-full py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Complete Package</span>
          </button>
        </div>
      </div>

      {/* Tax Schedule C Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Tax Year {selectedTaxYear} Schedule C Mapping Review
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Entity: {activeBusiness.name} (EIN: {activeBusiness.ein}) · Cash Accounting
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {scheduleCLines.map((line, idx) => {
            const isMeals = line.lineName.includes('Meals');
            const deductibleAmt = isMeals ? line.totalAmount * 0.5 : line.totalAmount;

            return (
              <div key={idx} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>{line.lineName}</span>
                    {isMeals && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        50% IRS Limit
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Includes: {line.categories.map((c) => c.name).join(', ')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-slate-900">
                    {formatCurrency(deductibleAmt)}
                  </div>
                  {isMeals && (
                    <div className="text-[10px] text-slate-400">
                      Total spent: {formatCurrency(line.totalAmount)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Schedule C Summary Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
          <div>
            <span className="text-slate-500 block text-[11px]">Gross Sales / Income:</span>
            <span className="text-base font-bold font-mono text-emerald-700">
              {formatCurrency(grossSales)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Total Deductible Expenses:</span>
            <span className="text-base font-bold font-mono text-slate-900">
              {formatCurrency(totalDeductibleExpenses + cogsTotal)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Est. Net Schedule C Income:</span>
            <span
              className={`text-base font-bold font-mono ${
                estimatedScheduleCNet >= 0 ? 'text-teal-800' : 'text-rose-600'
              }`}
            >
              {formatCurrency(estimatedScheduleCNet)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
