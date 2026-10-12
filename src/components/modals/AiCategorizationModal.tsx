import React from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { X, Sparkles, CheckCircle2, Tag } from 'lucide-react';

interface AiCategorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiCategorizationModal: React.FC<AiCategorizationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { transactions, activeBusiness } = useAccounting();
  const { aiEnabled } = useAuth();

  if (!isOpen) return null;

  // Filter recently AI-categorized transactions
  const aiCategorizedTxs = transactions.filter((t) => t.aiReasoning);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                AI Categorization Results
              </h2>
              <p className="text-xs text-slate-500">
                AI classified transactions for {activeBusiness.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {aiCategorizedTxs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {aiEnabled ? (
                <>No transactions have been categorized by AI yet. Run "AI Auto-Categorize" from the Transactions register.</>
              ) : (
                <>
                  AI categorization isn't configured. Set <code className="font-mono">OPENROUTER_API_KEY</code> on the
                  server and restart it to enable this feature.
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 font-medium">
                Showing {aiCategorizedTxs.length} transactions automatically matched:
              </div>

              {aiCategorizedTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/30 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{tx.payee || tx.description}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {tx.date} · {tx.description}
                      </div>
                    </div>
                    <span
                      className={`font-mono font-bold text-xs ${
                        tx.amount > 0 ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-teal-100/60">
                    <span className="font-semibold text-teal-900 bg-teal-100/80 px-2 py-0.5 rounded text-[11px]">
                      {tx.categoryName}
                    </span>
                    {tx.scheduleCLine && (
                      <span className="text-[10px] text-slate-500">({tx.scheduleCLine})</span>
                    )}
                    {tx.aiConfidence && (
                      <span className="text-[10px] text-teal-700 font-medium ml-auto">
                        Confidence: {(tx.aiConfidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {tx.aiReasoning && (
                    <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-teal-100">
                      <span className="font-semibold text-slate-700">Reasoning:</span>{' '}
                      {tx.aiReasoning}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors"
          >
            Done Reviewing
          </button>
        </div>
      </div>
    </div>
  );
};
