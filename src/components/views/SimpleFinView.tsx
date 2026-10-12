import React, { useState } from 'react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import {
  Link2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building,
  CreditCard,
  DollarSign,
  Key,
  ExternalLink,
  Upload,
  Info,
} from 'lucide-react';

interface SimpleFinViewProps {
  onOpenImportCsv: () => void;
}

export const SimpleFinView: React.FC<SimpleFinViewProps> = ({ onOpenImportCsv }) => {
  const {
    activeBusiness,
    accounts,
    bridgeConfig,
    connectSimpleFinWithToken,
    connectSimpleFinAccessUrl,
    disconnectSimpleFin,
    syncSimpleFin,
    isSyncing,
    syncError,
  } = useAccounting();

  const [setupTokenInput, setSetupTokenInput] = useState('');
  const [accessUrlInput, setAccessUrlInput] = useState('');
  const [useDirectUrl, setUseDirectUrl] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConnectWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupTokenInput.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await connectSimpleFinWithToken(setupTokenInput.trim());
      if (res.success) {
        setStatusMessage('Successfully connected SimpleFIN! Syncing initial accounts...');
        setSetupTokenInput('');
        await syncSimpleFin();
        setStatusMessage('Initial bank sync completed successfully.');
      } else {
        setStatusMessage(res.error || 'Connection failed.');
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'Error connecting to SimpleFIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectWithDirectUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessUrlInput.trim()) return;

    connectSimpleFinAccessUrl(accessUrlInput.trim(), false);
    setStatusMessage('Access URL saved! Syncing accounts...');
    setAccessUrlInput('');
    syncSimpleFin().then(() => {
      setStatusMessage('Bank feeds synced successfully.');
    }).catch((err) => {
      setStatusMessage(err.message || 'Sync failed.');
    });
  };

  const handleTryDemoSandbox = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await connectSimpleFinWithToken('demo');
      if (res.success) {
        setStatusMessage('Connected to SimpleFIN Demo Sandbox. Syncing test accounts...');
        await syncSimpleFin();
        setStatusMessage('Demo accounts and recent bank feeds synced!');
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'Demo connection failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConnected = bridgeConfig.status === 'connected' && !!bridgeConfig.accessUrl;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeBusiness.currency || 'USD',
    }).format(val);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              SimpleFIN Bridge Integration
            </h1>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isConnected ? (bridgeConfig.isDemo ? 'Sandbox Demo' : 'Connected') : 'Disconnected'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Connect checking accounts, credit cards, mortgages, and loans securely. SimpleFIN
            provides standard bank feeds without the subscription fees of proprietary aggregators.
          </p>
        </div>

        {isConnected && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncSimpleFin().catch(() => {})}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Bank Feeds Now'}</span>
            </button>
            <button
              onClick={disconnectSimpleFin}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-600 bg-white border border-slate-200 hover:bg-rose-50/50 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Sync Status / Error Messages */}
      {(statusMessage || syncError) && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 shadow-xs ${
            syncError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-teal-50 border-teal-200 text-teal-800'
          }`}
        >
          {syncError ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <div>{syncError || statusMessage}</div>
        </div>
      )}

      {/* Connection Box (if not connected) */}
      {!isConnected ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 flex-shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Connect {activeBusiness.name} to SimpleFIN
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                SimpleFIN Bridge acts as your personal financial bridge. Get your setup token from
                your SimpleFIN account and paste it below.
              </p>
            </div>
          </div>

          {/* Form */}
          {!useDirectUrl ? (
            <form onSubmit={handleConnectWithToken} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SimpleFIN Setup Token
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={setupTokenInput}
                    onChange={(e) => setSetupTokenInput(e.target.value)}
                    placeholder="Paste base64 Setup Token (e.g., aHR0cHM6Ly9icmlkZ2Uuc2ltcGxlZmluLm9yZy...)"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Generate this in your account at{' '}
                  <a
                    href="https://bridge.simplefin.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-700 underline inline-flex items-center gap-0.5"
                  >
                    bridge.simplefin.org <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !setupTokenInput.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Claiming Token...' : 'Connect SimpleFIN'}
                </button>

                <button
                  type="button"
                  onClick={handleTryDemoSandbox}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors"
                >
                  Try Demo SimpleFIN Sandbox
                </button>

                <button
                  type="button"
                  onClick={() => setUseDirectUrl(true)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline ml-auto"
                >
                  Have an Access URL instead?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConnectWithDirectUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SimpleFIN Access URL (with credentials)
                </label>
                <input
                  type="text"
                  value={accessUrlInput}
                  onChange={(e) => setAccessUrlInput(e.target.value)}
                  placeholder="https://user:password@bridge.simplefin.org/simplefin"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!accessUrlInput.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  Save Access URL & Sync
                </button>
                <button
                  type="button"
                  onClick={() => setUseDirectUrl(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Back to Setup Token
                </button>
              </div>
            </form>
          )}

          {/* Privacy & Security Note */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Direct & Private:</span>{' '}
              LiteLedger uses SimpleFIN's read-only protocol. We only retrieve transaction history
              and balances necessary for bookkeeping. No third-party data broker advertising.
            </div>
          </div>
        </div>
      ) : (
        /* Connected Status Card */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {bridgeConfig.isDemo ? 'SimpleFIN Demo Sandbox Active' : 'SimpleFIN Bridge Connected'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {bridgeConfig.lastSyncedAt
                    ? `Last synchronized on ${new Date(bridgeConfig.lastSyncedAt).toLocaleString()}`
                    : 'Initial sync pending'}
                </div>
              </div>
            </div>

            <div className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
              {bridgeConfig.accessUrl.includes('@')
                ? `https://••••••••@${bridgeConfig.accessUrl.split('@')[1]}`
                : 'https://bridge.simplefin.org/simplefin'}
            </div>
          </div>

          {/* Accounts Feed Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-400 mb-3">
              Synced Accounts for {activeBusiness.name} ({accounts.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                      {acc.type === 'checking' || acc.type === 'savings' ? (
                        <DollarSign className="w-4 h-4 text-teal-700" />
                      ) : acc.type === 'credit_card' ? (
                        <CreditCard className="w-4 h-4 text-indigo-700" />
                      ) : (
                        <Building className="w-4 h-4 text-amber-700" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{acc.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {acc.institution} · •••• {acc.accountNumberLast4}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold font-mono text-slate-900">
                      {formatCurrency(acc.currentBalance)}
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium">Synced</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Statement Import Option */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Manual Bank Statement Import (CSV)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Have bank or credit card exports from an institution that doesn't use SimpleFIN?
              Upload or paste your CSV statement anytime.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenImportCsv}
          className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
        >
          Import Statement File
        </button>
      </div>
    </div>
  );
};
