import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext.tsx';
import {
  Building2,
  ChevronDown,
  Plus,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
} from 'lucide-react';
import { Business } from '../types.ts';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAddBusiness: () => void;
  onOpenAiReview: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddBusiness,
  onOpenAiReview,
}) => {
  const {
    businesses,
    activeBusiness,
    setActiveBusinessId,
    bridgeConfig,
    syncSimpleFin,
    isSyncing,
    transactions,
    autoCategorizeWithAI,
    isAiCategorizing,
  } = useAccounting();

  const [bizDropdownOpen, setBizDropdownOpen] = useState(false);

  const uncategorizedCount = transactions.filter((t) => !t.categoryId).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'bank-feeds', label: 'Bank Feeds (SimpleFIN)' },
    { id: 'reconcile', label: 'Reconcile' },
    { id: 'profit-loss', label: 'Profit & Loss' },
    { id: 'tax-export', label: 'Tax & CPA Export' },
    { id: 'settings', label: 'Settings & Chart of Accounts' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner & Entity Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Entity Switcher */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center text-white shadow-xs font-bold text-lg tracking-tight">
                K
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900 block leading-tight">
                  KiteBooks
                </span>
                <span className="text-[11px] font-medium text-slate-500 tracking-wide uppercase">
                  Small Business Edition
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            {/* Business Entity Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setBizDropdownOpen(!bizDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                title="Switch Business Entity"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: activeBusiness.color || '#0f766e' }}
                />
                <div className="max-w-[200px] truncate">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {activeBusiness.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {activeBusiness.structure} · EIN {activeBusiness.ein || 'None'}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
              </button>

              {bizDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setBizDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 divide-y divide-slate-100">
                    <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Your Business Entities ({businesses.length})
                    </div>
                    <div className="py-1 max-h-60 overflow-y-auto">
                      {businesses.map((biz) => (
                        <button
                          key={biz.id}
                          onClick={() => {
                            setActiveBusinessId(biz.id);
                            setBizDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-colors ${
                            biz.id === activeBusiness.id
                              ? 'bg-teal-50/80 text-teal-900'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: biz.color || '#0f766e' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{biz.name}</div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {biz.structure} · {biz.industry}
                            </div>
                          </div>
                          {biz.id === activeBusiness.id && (
                            <span className="text-[11px] font-semibold text-teal-700">Active</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="p-1.5 bg-slate-50">
                      <button
                        onClick={() => {
                          setBizDropdownOpen(false);
                          onOpenAddBusiness();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-teal-700 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors border border-dashed border-teal-300"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Another Business Entity</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Header Controls & Status */}
          <div className="flex items-center gap-3">
            {/* SimpleFIN Bank Feed Status Badge */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  bridgeConfig.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] font-medium">
                {bridgeConfig.status === 'connected'
                  ? bridgeConfig.isDemo
                    ? 'SimpleFIN (Sandbox)'
                    : 'SimpleFIN Connected'
                  : 'Bank Feed Disconnected'}
              </span>
              {bridgeConfig.status === 'connected' && (
                <button
                  onClick={() => syncSimpleFin().catch(() => {})}
                  disabled={isSyncing}
                  className="hover:text-slate-900 disabled:opacity-50 ml-1"
                  title="Sync Bank Feeds Now"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
                </button>
              )}
            </div>

            {/* AI Auto-Categorize Quick Action */}
            {uncategorizedCount > 0 && (
              <button
                onClick={() => {
                  autoCategorizeWithAI().then((res) => {
                    if (res.suggestions.length > 0) {
                      onOpenAiReview();
                    }
                  }).catch(() => {});
                }}
                disabled={isAiCategorizing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
                title="Use Gemini AI to categorize all pending transactions"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiCategorizing ? 'animate-spin' : ''}`} />
                <span>
                  {isAiCategorizing ? 'Categorizing...' : `AI Categorize (${uncategorizedCount})`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 overflow-x-auto">
        <nav className="flex space-x-1 sm:space-x-4 py-1" aria-label="Tabs">
          {navItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-teal-900 bg-teal-50 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
