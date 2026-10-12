import React, { useState } from 'react';
import { AccountingProvider, useAccounting } from './context/AccountingContext.tsx';
import { Header } from './components/Header.tsx';
import { DashboardView } from './components/views/DashboardView.tsx';
import { TransactionsView } from './components/views/TransactionsView.tsx';
import { SimpleFinView } from './components/views/SimpleFinView.tsx';
import { ReconciliationView } from './components/views/ReconciliationView.tsx';
import { ProfitLossView } from './components/views/ProfitLossView.tsx';
import { TaxExportView } from './components/views/TaxExportView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';
import { AddBusinessModal } from './components/modals/AddBusinessModal.tsx';
import { AddTransactionModal } from './components/modals/AddTransactionModal.tsx';
import { ImportCsvModal } from './components/modals/ImportCsvModal.tsx';
import { AiCategorizationModal } from './components/modals/AiCategorizationModal.tsx';

function MainApp() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modals
  const [isAddBusinessOpen, setIsAddBusinessOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [isAiReviewOpen, setIsAiReviewOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddBusiness={() => setIsAddBusinessOpen(true)}
        onOpenAiReview={() => setIsAiReviewOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={setActiveTab}
            onOpenAddTransaction={() => setIsAddTransactionOpen(true)}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            onOpenAddTransaction={() => setIsAddTransactionOpen(true)}
            onOpenImportCsv={() => setIsImportCsvOpen(true)}
            onOpenAiReview={() => setIsAiReviewOpen(true)}
          />
        )}

        {activeTab === 'bank-feeds' && (
          <SimpleFinView onOpenImportCsv={() => setIsImportCsvOpen(true)} />
        )}

        {activeTab === 'reconcile' && <ReconciliationView />}

        {activeTab === 'profit-loss' && <ProfitLossView />}

        {activeTab === 'tax-export' && <TaxExportView />}

        {activeTab === 'settings' && (
          <SettingsView onOpenAddBusiness={() => setIsAddBusinessOpen(true)} />
        )}
      </main>

      {/* Clean quiet footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <span className="font-semibold text-slate-700">LiteLedger</span> · Multi-Entity Small
            Business Accounting & SimpleFIN Bank Feeds
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>IRS Schedule C Aligned</span>
            <span>·</span>
            <span>Zero Subscription Aggregator Lock-in</span>
            <span>·</span>
            <span>Powered by OpenRouter</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddBusinessModal
        isOpen={isAddBusinessOpen}
        onClose={() => setIsAddBusinessOpen(false)}
      />

      <AddTransactionModal
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
      />

      <ImportCsvModal
        isOpen={isImportCsvOpen}
        onClose={() => setIsImportCsvOpen(false)}
      />

      <AiCategorizationModal
        isOpen={isAiReviewOpen}
        onClose={() => setIsAiReviewOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AccountingProvider>
      <MainApp />
    </AccountingProvider>
  );
}
