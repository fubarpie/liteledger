import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Sparkles } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiGet } from '../../api.ts';
import { AccountType, BusinessStructure } from '../../types.ts';
import { readLegacyBrowserData } from '../../legacyLocal.ts';
import { LegacyImport } from './LegacyImport.tsx';

const STRUCTURES: BusinessStructure[] = [
  'LLC',
  'Sole Proprietorship',
  'S-Corporation',
  'Partnership',
  'C-Corporation',
];

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'loan', label: 'Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'other', label: 'Other' },
];

const COLORS = ['#4f46e5', '#0f766e', '#0284c7', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#475569'];

interface Template {
  key: string;
  name: string;
  description: string;
  count: number;
}

interface DraftAccount {
  key: number;
  name: string;
  type: AccountType;
  institution: string;
  last4: string;
  balance: string;
}

const STEPS = ['Welcome', 'Business', 'Categories', 'Accounts', 'Review'];

const inputCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

export const OnboardingWizard: React.FC = () => {
  const { addBusiness } = useAccounting();
  const { user, logout } = useAuth();

  const [step, setStep] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const hasLegacy = readLegacyBrowserData() !== null;

  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [structure, setStructure] = useState<BusinessStructure>('Sole Proprietorship');
  const [ein, setEin] = useState('');
  const [industry, setIndustry] = useState('');
  const [fiscalYearEnd, setFiscalYearEnd] = useState('12-31');
  const [color, setColor] = useState(COLORS[0]);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [template, setTemplate] = useState<'schedule-c' | 'none'>('schedule-c');

  const [accounts, setAccounts] = useState<DraftAccount[]>([]);
  const [nextKey, setNextKey] = useState(1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ templates: Template[] }>('/api/category-templates')
      .then((r) => !cancelled && setTemplates(r.templates || []))
      .catch((e) => !cancelled && setTemplatesError(e?.message || 'Could not load templates'));
    return () => {
      cancelled = true;
    };
  }, []);

  const fyValid = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(fiscalYearEnd);
  const canNext = step === 1 ? name.trim().length > 0 && fyValid : true;

  const addDraftAccount = () => {
    setAccounts((a) => [
      ...a,
      { key: nextKey, name: '', type: 'checking', institution: '', last4: '', balance: '' },
    ]);
    setNextKey((k) => k + 1);
  };
  const patchAccount = (key: number, patch: Partial<DraftAccount>) =>
    setAccounts((a) => a.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const namedAccounts = accounts.filter((a) => a.name.trim());

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      await addBusiness(
        {
          name: name.trim(),
          legalName: legalName.trim(),
          structure,
          ein: ein.trim(),
          industry: industry.trim(),
          fiscalYearEnd,
          currency: 'USD',
          color,
        },
        {
          categoryTemplate: template,
          accounts: namedAccounts.map((a) => {
            const bal = parseFloat(a.balance);
            return {
              name: a.name.trim(),
              type: a.type,
              institution: a.institution.trim(),
              accountNumberLast4: a.last4.replace(/\D/g, '').slice(-4),
              currentBalance: Number.isFinite(bal) ? bal : 0,
            };
          }),
        }
      );
      // businesses is now non-empty; App swaps this wizard out for the main app.
    } catch (err: any) {
      setError(err?.message || 'Something went wrong while creating your business.');
      setSaving(false);
    }
  };

  const money = (n: string) => {
    const v = parseFloat(n);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isFinite(v) ? v : 0);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="text-lg font-bold text-indigo-700 tracking-tight">LiteLedger</div>
        <div className="text-xs text-slate-500 flex items-center gap-3">
          {user && <span>Signed in as <span className="font-semibold text-slate-700">{user.name}</span></span>}
          <button type="button" onClick={() => logout().catch(() => {})} className="text-indigo-600 hover:underline">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-2xl">
          {/* Progress */}
          <ol className="flex items-center gap-2 mb-6" aria-label="Setup progress">
            {STEPS.map((label, i) => (
              <li key={label} className="flex-1" aria-current={i === step ? 'step' : undefined}>
                <div className={`h-1.5 rounded-full ${i <= step ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                <div className={`mt-1.5 text-[11px] font-medium ${i === step ? 'text-indigo-700' : 'text-slate-400'}`}>
                  {label}
                </div>
              </li>
            ))}
          </ol>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            {step === 0 && (
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
                  </h1>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    Let's set up your first business. It takes about a minute: a few details, a chart of
                    accounts, and (optionally) your bank accounts. You can change everything later.
                  </p>
                </div>
                {hasLegacy && (
                  <div className="space-y-3">
                    {!showImport ? (
                      <button
                        type="button"
                        onClick={() => setShowImport(true)}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Import data from your old LiteLedger/KiteBooks browser storage
                      </button>
                    ) : (
                      <LegacyImport onDone={() => setShowImport(false)} />
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Business details</h2>
                  <p className="text-sm text-slate-500 mt-1">Tell us about the business you're keeping books for.</p>
                </div>
                <div>
                  <label htmlFor="ob-name" className={labelCls}>
                    Business name <span className="text-rose-500">*</span>
                  </label>
                  <input id="ob-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Ventling Consulting" autoFocus />
                </div>
                <div>
                  <label htmlFor="ob-legal" className={labelCls}>Legal name (optional)</label>
                  <input id="ob-legal" className={inputCls} value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ob-structure" className={labelCls}>Legal structure</label>
                    <select id="ob-structure" className={inputCls} value={structure} onChange={(e) => setStructure(e.target.value as BusinessStructure)}>
                      {STRUCTURES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ob-ein" className={labelCls}>EIN (optional)</label>
                    <input id="ob-ein" className={`${inputCls} font-mono`} value={ein} onChange={(e) => setEin(e.target.value)} placeholder="XX-XXXXXXX" />
                  </div>
                  <div>
                    <label htmlFor="ob-industry" className={labelCls}>Industry</label>
                    <input id="ob-industry" className={inputCls} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g., Consulting, Retail" />
                  </div>
                  <div>
                    <label htmlFor="ob-fye" className={labelCls}>Fiscal year end (MM-DD)</label>
                    <input id="ob-fye" className={`${inputCls} font-mono`} value={fiscalYearEnd} onChange={(e) => setFiscalYearEnd(e.target.value)} placeholder="12-31" aria-invalid={!fyValid} />
                    {!fyValid && <p className="text-[11px] text-rose-600 mt-1">Use MM-DD, for example 12-31.</p>}
                  </div>
                </div>
                <div>
                  <span className={labelCls}>Color</span>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Business color">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={color === c}
                        aria-label={`Color ${c}`}
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${color === c ? 'ring-2 ring-slate-800' : ''}`}
                        style={{ backgroundColor: c }}
                      >
                        {color === c && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Chart of accounts</h2>
                  <p className="text-sm text-slate-500 mt-1">Categories you'll use to sort income and expenses.</p>
                </div>
                {templatesError && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    Couldn't load template details ({templatesError}). You can still choose below.
                  </div>
                )}
                <div className="space-y-3" role="radiogroup" aria-label="Chart of accounts template">
                  {(['schedule-c', 'none'] as const).map((key) => {
                    const t = templates.find((x) => x.key === key);
                    const title = t?.name || (key === 'none' ? 'Start empty' : 'General small business (IRS Schedule C)');
                    const desc =
                      t?.description ||
                      (key === 'none'
                        ? 'No categories - build your own chart of accounts.'
                        : 'Income, cost of goods, and the standard Schedule C expense lines.');
                    const selected = template === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTemplate(key)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${selected ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{title}</span>
                          {key === 'schedule-c' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Recommended</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{desc}</p>
                        {t && t.count > 0 && <p className="text-[11px] text-slate-400 mt-1">{t.count} categories</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Bank accounts</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Add the accounts you want to track. This is optional: you can skip it, add accounts later in Settings, or connect them automatically with SimpleFIN.
                  </p>
                </div>

                {accounts.map((a, idx) => (
                  <fieldset key={a.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <legend className="text-xs font-semibold text-slate-700">Account {idx + 1}</legend>
                      <button
                        type="button"
                        onClick={() => setAccounts((x) => x.filter((y) => y.key !== a.key))}
                        aria-label={`Remove account ${idx + 1}`}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls} htmlFor={`acc-name-${a.key}`}>Name</label>
                        <input id={`acc-name-${a.key}`} className={inputCls} value={a.name} onChange={(e) => patchAccount(a.key, { name: e.target.value })} placeholder="e.g., Business Checking" />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor={`acc-type-${a.key}`}>Type</label>
                        <select id={`acc-type-${a.key}`} className={inputCls} value={a.type} onChange={(e) => patchAccount(a.key, { type: e.target.value as AccountType })}>
                          {ACCOUNT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls} htmlFor={`acc-inst-${a.key}`}>Institution</label>
                        <input id={`acc-inst-${a.key}`} className={inputCls} value={a.institution} onChange={(e) => patchAccount(a.key, { institution: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls} htmlFor={`acc-last4-${a.key}`}>Last 4</label>
                          <input id={`acc-last4-${a.key}`} className={`${inputCls} font-mono`} maxLength={4} inputMode="numeric" value={a.last4} onChange={(e) => patchAccount(a.key, { last4: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelCls} htmlFor={`acc-bal-${a.key}`}>Opening balance</label>
                          <input id={`acc-bal-${a.key}`} className={`${inputCls} font-mono`} type="number" step="0.01" value={a.balance} onChange={(e) => patchAccount(a.key, { balance: e.target.value })} placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  </fieldset>
                ))}

                <button
                  type="button"
                  onClick={addDraftAccount}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg"
                >
                  <Plus className="w-4 h-4" /> Add an account
                </button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Review & finish</h2>
                  <p className="text-sm text-slate-500 mt-1">Everything look right? You can edit all of this later.</p>
                </div>
                <dl className="text-sm divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  <Row label="Business">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      {name.trim()}
                    </span>
                  </Row>
                  {legalName.trim() && <Row label="Legal name">{legalName.trim()}</Row>}
                  <Row label="Structure">{structure}</Row>
                  {ein.trim() && <Row label="EIN">{ein.trim()}</Row>}
                  {industry.trim() && <Row label="Industry">{industry.trim()}</Row>}
                  <Row label="Fiscal year end">{fiscalYearEnd}</Row>
                  <Row label="Chart of accounts">
                    {template === 'schedule-c' ? 'IRS Schedule C categories' : 'Start empty'}
                  </Row>
                  <Row label="Accounts">
                    {namedAccounts.length === 0 ? (
                      <span className="text-slate-500">None yet</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {namedAccounts.map((a) => (
                          <li key={a.key}>
                            {a.name.trim()} <span className="text-slate-400">({a.type.replace('_', ' ')}, {money(a.balance)})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Row>
                </dl>
                {error && (
                  <div role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 0 || saving}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:invisible"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                >
                  {step === 0 ? 'Get started' : step === 3 && accounts.length === 0 ? 'Skip for now' : 'Next'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving || !name.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Finish setup'}
                  {!saving && <Check className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 px-4 py-2.5">
    <dt className="text-slate-500 flex-shrink-0">{label}</dt>
    <dd className="text-slate-900 text-right">{children}</dd>
  </div>
);
