import React, { useState } from 'react';
import { AccountingProvider, useAccounting } from './context/AccountingContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AuthScreen } from './components/auth/AuthScreen.tsx';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard.tsx';
import type { Transaction } from './types.ts';
import { Toast } from './components/Toast.tsx';
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
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
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
            onEditTransaction={setEditingTx}
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
        isOpen={isAddTransactionOpen || editingTx !== null}
        transaction={editingTx}
        onClose={() => {
          setIsAddTransactionOpen(false);
          setEditingTx(null);
        }}
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

function FullScreenMessage({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-lg font-semibold text-slate-800">{title}</div>
        {detail && <p className="mt-2 text-sm text-slate-500">{detail}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

/** Loads the user's data, then shows onboarding (no businesses yet) or the main app. */
function DataGate() {
  const { loading, loadError, reload, businesses } = useAccounting();
  if (loading) return <FullScreenMessage title="Loading your books..." />;
  if (loadError) {
    return (
      <FullScreenMessage
        title="Couldn't load your data"
        detail={loadError}
        action={
          <button onClick={reload} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            Try again
          </button>
        }
      />
    );
  }
  return (
    <>
      {businesses.length === 0 ? <OnboardingWizard /> : <MainApp />}
      <Toast />
    </>
  );
}

/** Signed out -> setup/login screen. Signed in -> data. Keyed by user so data never leaks between sessions. */
function AuthGate() {
  const { loading, user } = useAuth();
  if (loading) return <FullScreenMessage title="LiteLedger" />;
  if (!user) return <AuthScreen />;
  return (
    <AccountingProvider key={user.id}>
      <DataGate />
    </AccountingProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
