import React, { useState } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import { X, Building2 } from 'lucide-react';
import { AccountType, BusinessStructure } from '../../types.ts';

interface AddBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddBusinessModal: React.FC<AddBusinessModalProps> = ({ isOpen, onClose }) => {
  const { addBusiness } = useAccounting();

  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [structure, setStructure] = useState<BusinessStructure>('LLC');
  const [ein, setEin] = useState('');
  const [industry, setIndustry] = useState('');
  const [fiscalYearEnd, setFiscalYearEnd] = useState('12-31');
  const [currency, setCurrency] = useState('USD');
  const [color, setColor] = useState('#0f766e');
  const [categoryTemplate, setCategoryTemplate] = useState<'schedule-c' | 'none'>('schedule-c');
  const [addAccount, setAddAccount] = useState(false);
  const [acctName, setAcctName] = useState('');
  const [acctType, setAcctType] = useState<AccountType>('checking');
  const [acctBalance, setAcctBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    setError(null);
    try {
      const balance = parseFloat(acctBalance);
      await addBusiness(
        {
          name: name.trim(),
          legalName: legalName.trim() || name.trim(),
          structure,
          ein: ein.trim(),
          industry: industry.trim(),
          fiscalYearEnd,
          currency,
          color,
        },
        {
          categoryTemplate,
          accounts:
            addAccount && acctName.trim()
              ? [
                  {
                    name: acctName.trim(),
                    type: acctType,
                    institution: '',
                    accountNumberLast4: '',
                    currentBalance: Number.isFinite(balance) ? balance : 0,
                  },
                ]
              : [],
        }
      );
      setName('');
      setLegalName('');
      setEin('');
      setIndustry('');
      setAddAccount(false);
      setAcctName('');
      setAcctBalance('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not create the business.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add New Business Entity</h2>
              <p className="text-xs text-slate-500">
                Keep books and bank accounts completely separated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Business Common Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ventling Consulting"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Legal Registered Name
            </label>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g., Ventling Business Consulting Services LLC"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Legal Structure
              </label>
              <select
                value={structure}
                onChange={(e) => setStructure(e.target.value as BusinessStructure)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="LLC">LLC</option>
                <option value="Sole Proprietorship">Sole Proprietorship</option>
                <option value="S-Corporation">S-Corporation</option>
                <option value="Partnership">Partnership</option>
                <option value="C-Corporation">C-Corporation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                EIN / Tax ID
              </label>
              <input
                type="text"
                value={ein}
                onChange={(e) => setEin(e.target.value)}
                placeholder="XX-XXXXXXX"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Industry / Trade
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g., Consulting, Retail, Trades"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Badge Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-8 rounded border border-slate-200 p-0.5 cursor-pointer"
                />
                <span className="text-xs text-slate-500 font-mono">{color}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chart of Accounts</label>
              <select
                value={categoryTemplate}
                onChange={(e) => setCategoryTemplate(e.target.value as 'schedule-c' | 'none')}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="schedule-c">IRS Schedule C categories (recommended)</option>
                <option value="none">Start empty</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={addAccount} onChange={(e) => setAddAccount(e.target.checked)} />
              Add an opening bank account (optional, you can add accounts later)
            </label>
            {addAccount && (
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={acctName}
                  onChange={(e) => setAcctName(e.target.value)}
                  placeholder="Account name"
                  aria-label="Account name"
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <select
                  value={acctType}
                  onChange={(e) => setAcctType(e.target.value as AccountType)}
                  aria-label="Account type"
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit card</option>
                  <option value="loan">Loan</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={acctBalance}
                  onChange={(e) => setAcctBalance(e.target.value)}
                  placeholder="Opening balance"
                  aria-label="Opening balance"
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              {error}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Business Entity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
