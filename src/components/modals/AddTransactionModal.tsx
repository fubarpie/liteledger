import React, { useEffect, useState } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import { Transaction } from '../../types.ts';
import { X, Lock, Trash2 } from 'lucide-react';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, the modal edits this transaction instead of creating a new one. */
  transaction?: Transaction | null;
}

const today = () => new Date().toISOString().split('T')[0];

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ isOpen, onClose, transaction }) => {
  const { activeBusiness, accounts, categories, addTransaction, updateTransaction, deleteTransaction } =
    useAccounting();

  const isEdit = !!transaction;
  const locked = !!transaction?.reconciled;

  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(today());
  const [payee, setPayee] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  // (Re)initialize whenever the modal opens or the target transaction changes.
  useEffect(() => {
    if (!isOpen) return;
    setConfirmDelete(false);
    setError('');
    if (transaction) {
      setAccountId(transaction.accountId);
      setDate(transaction.date);
      setPayee(transaction.payee);
      setDescription(transaction.description);
      setType(transaction.amount < 0 ? 'expense' : 'income');
      setAmountStr(Math.abs(transaction.amount).toFixed(2));
      setCategoryId(transaction.categoryId || '');
      setNotes(transaction.notes || '');
    } else {
      setAccountId(accounts[0]?.id || '');
      setDate(today());
      setPayee('');
      setDescription('');
      setType('expense');
      setAmountStr('');
      setCategoryId('');
      setNotes('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, transaction?.id]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.abs(parseFloat(amountStr) || 0);
    if (!locked && parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!payee.trim() && !description.trim()) {
      setError('Please enter a payee or description.');
      return;
    }
    const finalAmount = type === 'expense' ? -parsedAmount : parsedAmount;

    if (transaction) {
      const updates: Partial<Transaction> = {};
      const newPayee = payee.trim() || description.trim();
      const newDesc = description.trim() || payee.trim();
      if (newPayee !== transaction.payee) updates.payee = newPayee;
      if (newDesc !== transaction.description) updates.description = newDesc;
      if ((categoryId || null) !== (transaction.categoryId || null)) updates.categoryId = categoryId || null;
      if (notes.trim() !== (transaction.notes || '')) updates.notes = notes.trim();
      if (!locked) {
        if (date !== transaction.date) updates.date = date;
        if (Math.round(finalAmount * 100) !== Math.round(transaction.amount * 100)) updates.amount = finalAmount;
        if (accountId && accountId !== transaction.accountId) updates.accountId = accountId;
      }
      if (Object.keys(updates).length) updateTransaction(transaction.id, updates);
      onClose();
      return;
    }

    const cat = categories.find((c) => c.id === categoryId);
    addTransaction({
      businessId: activeBusiness.id,
      accountId: accountId || accounts[0]?.id,
      date,
      payee: payee.trim() || description.trim(),
      description: description.trim() || payee.trim(),
      amount: finalAmount,
      categoryId: categoryId || null,
      categoryName: cat?.name,
      scheduleCLine: cat?.scheduleCLine,
      reconciled: false,
      source: 'manual',
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!transaction) return;
    deleteTransaction(transaction.id);
    onClose();
  };

  const inputBase =
    'w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in-95">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Transaction' : 'Add Manual Transaction'}
            </h2>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {activeBusiness.name}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {locked && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
              <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                This transaction is part of a reconciled statement. Date, amount and account are locked; you can still
                change the payee, description, category and notes. Delete the reconciliation to unlock them.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              disabled={locked}
              onClick={() => setType('expense')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors disabled:cursor-not-allowed ${
                type === 'expense' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Money Out (Expense / Charge)
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => setType('income')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors disabled:cursor-not-allowed ${
                type === 'income' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Money In (Deposit / Revenue)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account <span className="text-rose-500">*</span>
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={locked}
                className={`${inputBase} bg-white font-medium`}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (•••• {a.accountNumberLast4})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={locked}
                className={`${inputBase} font-mono`}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount (USD) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">$</span>
              <input
                type="number"
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                disabled={locked}
                placeholder="0.00"
                className={`${inputBase} pl-7 font-mono font-bold text-slate-900`}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payee / Merchant <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="e.g., Home Depot, Client Name, Shell Oil"
              className={`${inputBase} font-medium`}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Memo</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Fasteners for job #201, Monthly retainer payment"
              className={inputBase}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`${inputBase} bg-white`}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Private Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for CPA or audit trail"
              className={inputBase}
            />
          </div>

          {error && <div className="text-[11px] font-medium text-rose-600">{error}</div>}

          {isEdit && (
            <div className="pt-3 border-t border-slate-100">
              {locked ? (
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Reconciled transactions can't be deleted. Remove the reconciliation first.
                </p>
              ) : confirmDelete ? (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                  <span className="text-[11px] text-rose-800 font-medium">Delete this transaction permanently?</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md"
                    >
                      Yes, delete
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete transaction
                </button>
              )}
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
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors"
            >
              {isEdit ? 'Save changes' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
