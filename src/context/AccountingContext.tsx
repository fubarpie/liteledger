import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Business,
  Account,
  Category,
  Transaction,
  Reconciliation,
  SimpleFinBridgeConfig,
} from '../types.ts';
import { api, apiGet, apiPost, apiPatch, apiPut, apiDelete, newClientId } from '../api.ts';

export interface Notice {
  kind: 'error' | 'success' | 'info';
  message: string;
}

export interface NewBusinessOptions {
  /** 'schedule-c' (default) seeds the standard IRS Schedule C chart of accounts; 'none' starts empty. */
  categoryTemplate?: 'schedule-c' | 'none';
  /** Bank / card accounts to create alongside the business. */
  accounts?: Array<Omit<Account, 'id' | 'businessId'>>;
}

interface AccountingContextType {
  /** true until the first server load finishes */
  loading: boolean;
  loadError: string | null;
  /** Re-fetch everything from the server (use after server-side bulk operations). */
  reload: () => Promise<void>;
  /** Transient toast-style message (errors from background saves land here). */
  notice: Notice | null;
  notify: (message: string, kind?: Notice['kind']) => void;
  dismissNotice: () => void;

  // Business
  businesses: Business[];
  activeBusinessId: string;
  /** Undefined only while there are no businesses yet (onboarding). */
  activeBusiness: Business;
  setActiveBusinessId: (id: string) => void;
  addBusiness: (biz: Omit<Business, 'id' | 'createdDate'>, options?: NewBusinessOptions) => Promise<Business>;
  updateBusiness: (id: string, updates: Partial<Business>) => void;
  deleteBusiness: (id: string) => void;

  // Accounts
  accounts: Account[];
  allAccounts: Account[];
  addAccount: (account: Omit<Account, 'id'>) => Account;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Categories (per business)
  categories: Category[];
  addCategory: (cat: Omit<Category, 'id' | 'businessId'>) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  // Transactions
  transactions: Transaction[];
  allTransactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id'>) => Transaction;
  addBatchTransactions: (txs: Omit<Transaction, 'id'>[]) => void;
  /** Edit any field of an existing transaction. Reconciled transactions only accept category/notes/payee/description edits. */
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  categorizeTransaction: (id: string, categoryId: string | null) => void;
  batchCategorizeTransactions: (ids: string[], categoryId: string) => void;
  autoCategorizeWithAI: (
    targetTxIds?: string[]
  ) => Promise<{ updatedCount: number; suggestions: any[] }>;
  isAiCategorizing: boolean;

  // Reconciliations
  reconciliations: Reconciliation[];
  saveReconciliation: (rec: Reconciliation) => void;
  deleteReconciliation: (id: string) => void;

  // SimpleFIN (credentials are stored encrypted on the server and never sent to the browser)
  bridgeConfig: SimpleFinBridgeConfig;
  connectSimpleFinWithToken: (setupToken: string) => Promise<{ success: boolean; error?: string }>;
  connectSimpleFinAccessUrl: (accessUrl: string) => Promise<{ success: boolean; error?: string }>;
  disconnectSimpleFin: () => void;
  syncSimpleFin: () => Promise<{ addedCount: number; message: string }>;
  isSyncing: boolean;
  syncError: string | null;
}

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

const ACTIVE_BIZ_KEY = 'liteledger_active_biz'; // UI preference only; all data lives on the server
const round2 = (n: number) => Math.round(n * 100) / 100;

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_BIZ_KEY) || '';
    } catch {
      return '';
    }
  });
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allReconciliations, setAllReconciliations] = useState<Reconciliation[]>([]);
  const [bridgeConfigs, setBridgeConfigs] = useState<Record<string, SimpleFinBridgeConfig>>({});

  const [isAiCategorizing, setIsAiCategorizing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const notify = useCallback((message: string, kind: Notice['kind'] = 'info') => setNotice({ kind, message }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  // ---- server load -------------------------------------------------------
  const applyState = useCallback((s: any) => {
    setBusinesses(s.businesses || []);
    setAllAccounts(s.accounts || []);
    setAllCategories(s.categories || []);
    setAllTransactions(s.transactions || []);
    setAllReconciliations(s.reconciliations || []);
    setBridgeConfigs(s.bridgeConfigs || {});
    setActiveBusinessIdState((cur) =>
      (s.businesses || []).some((b: Business) => b.id === cur) ? cur : s.businesses?.[0]?.id || ''
    );
  }, []);

  const reload = useCallback(async () => {
    try {
      applyState(await apiGet('/api/bootstrap'));
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e.message || 'Could not load your data');
    } finally {
      setLoading(false);
    }
  }, [applyState]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    try {
      if (activeBusinessId) localStorage.setItem(ACTIVE_BIZ_KEY, activeBusinessId);
    } catch {
      /* ignore */
    }
  }, [activeBusinessId]);

  // ---- background write queue ---------------------------------------------
  // The UI updates immediately; server writes run one at a time, in order. If one fails the user is told and
  // the screen is re-synced from the server so it never shows data that wasn't saved.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const persist = useCallback((label: string, fn: () => Promise<unknown>) => {
    const p = queue.current.then(fn).catch(async (e: any) => {
      if (e?.status !== 401) setNotice({ kind: 'error', message: `${label}: ${e?.message || 'save failed'}` });
      await reloadRef.current();
    });
    queue.current = p;
    return p;
  }, []);

  // ---- derived -------------------------------------------------------------
  const activeBusiness = useMemo(
    () => (businesses.find((b) => b.id === activeBusinessId) || businesses[0]) as Business,
    [businesses, activeBusinessId]
  );
  const currentId = activeBusiness?.id || '';

  const accounts = useMemo(() => allAccounts.filter((a) => a.businessId === currentId), [allAccounts, currentId]);
  const categories = useMemo(() => allCategories.filter((c) => c.businessId === currentId), [allCategories, currentId]);
  const transactions = useMemo(
    () =>
      allTransactions
        .filter((t) => t.businessId === currentId)
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)),
    [allTransactions, currentId]
  );
  const reconciliations = useMemo(
    () =>
      allReconciliations
        .filter((r) => r.businessId === currentId)
        .sort((a, b) => (a.statementDate < b.statementDate ? 1 : -1)),
    [allReconciliations, currentId]
  );
  const bridgeConfig = useMemo<SimpleFinBridgeConfig>(
    () =>
      bridgeConfigs[currentId] || {
        businessId: currentId,
        accessUrl: '',
        isDemo: false,
        lastSyncedAt: null,
        status: 'disconnected',
      },
    [bridgeConfigs, currentId]
  );

  const setActiveBusinessId = useCallback((id: string) => {
    setActiveBusinessIdState(id);
    setSyncError(null);
  }, []);

  // ---- helpers -------------------------------------------------------------
  const bumpBalance = useCallback((accountId: string, delta: number) => {
    if (!delta) return;
    setAllAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, currentBalance: round2(a.currentBalance + delta) } : a))
    );
  }, []);

  const withCategory = useCallback(
    (t: Transaction, categoryId: string | null): Transaction => {
      const cat = allCategories.find((c) => c.id === categoryId);
      return {
        ...t,
        categoryId,
        categoryName: cat?.name,
        scheduleCLine: cat?.scheduleCLine,
      };
    },
    [allCategories]
  );

  // ---- businesses -----------------------------------------------------------
  const addBusiness = useCallback(
    async (bizData: Omit<Business, 'id' | 'createdDate'>, options: NewBusinessOptions = {}) => {
      // Wait for pending writes so ordering stays sane, then let the server seed categories/accounts.
      await queue.current;
      const state = await apiPost('/api/businesses', {
        ...bizData,
        categoryTemplate: options.categoryTemplate ?? 'schedule-c',
        accounts: options.accounts ?? [],
      });
      const created: Business = state.businesses[0];
      setBusinesses((prev) => [...prev, created]);
      setAllAccounts((prev) => [...prev, ...state.accounts]);
      setAllCategories((prev) => [...prev, ...state.categories]);
      setBridgeConfigs((prev) => ({ ...prev, ...state.bridgeConfigs }));
      setActiveBusinessIdState(created.id);
      return created;
    },
    []
  );

  const updateBusiness = useCallback(
    (id: string, updates: Partial<Business>) => {
      setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
      const { id: _i, createdDate: _c, ...body } = updates as any;
      persist('Could not save business', () => apiPatch(`/api/businesses/${id}`, body));
    },
    [persist]
  );

  const deleteBusiness = useCallback(
    (id: string) => {
      if (businesses.length <= 1) {
        notify('You must keep at least one business.', 'error');
        return;
      }
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      setAllAccounts((prev) => prev.filter((a) => a.businessId !== id));
      setAllCategories((prev) => prev.filter((c) => c.businessId !== id));
      setAllTransactions((prev) => prev.filter((t) => t.businessId !== id));
      setAllReconciliations((prev) => prev.filter((r) => r.businessId !== id));
      const next = businesses.find((b) => b.id !== id);
      if (next && activeBusinessId === id) setActiveBusinessIdState(next.id);
      persist('Could not delete business', () => apiDelete(`/api/businesses/${id}`));
    },
    [businesses, activeBusinessId, persist, notify]
  );

  // ---- accounts --------------------------------------------------------------
  const addAccount = useCallback(
    (data: Omit<Account, 'id'>) => {
      const acc: Account = { ...data, id: newClientId('act') };
      setAllAccounts((prev) => [...prev, acc]);
      persist('Could not save account', () => apiPost('/api/accounts', acc));
      return acc;
    },
    [persist]
  );

  const updateAccount = useCallback(
    (id: string, updates: Partial<Account>) => {
      setAllAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
      const { id: _i, businessId: _b, simplefinAccountId: _s, lastSyncedAt: _l, ...body } = updates as any;
      persist('Could not save account', () => apiPatch(`/api/accounts/${id}`, body));
    },
    [persist]
  );

  const deleteAccount = useCallback(
    (id: string) => {
      setAllAccounts((prev) => prev.filter((a) => a.id !== id));
      setAllTransactions((prev) => prev.filter((t) => t.accountId !== id));
      persist('Could not delete account', () => apiDelete(`/api/accounts/${id}`));
    },
    [persist]
  );

  // ---- categories ------------------------------------------------------------
  const addCategory = useCallback(
    (data: Omit<Category, 'id' | 'businessId'>) => {
      const cat: Category = { ...data, id: newClientId('cat'), businessId: currentId };
      setAllCategories((prev) => [...prev, cat]);
      persist('Could not save category', () => apiPost('/api/categories', cat));
      return cat;
    },
    [currentId, persist]
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Category>) => {
      setAllCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      // keep denormalized names on transactions fresh
      setAllTransactions((prev) =>
        prev.map((t) =>
          t.categoryId === id
            ? {
                ...t,
                categoryName: updates.name ?? t.categoryName,
                scheduleCLine: updates.scheduleCLine ?? t.scheduleCLine,
              }
            : t
        )
      );
      const { id: _i, businessId: _b, ...body } = updates as any;
      persist('Could not save category', () => apiPatch(`/api/categories/${id}`, body));
    },
    [persist]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setAllCategories((prev) => prev.filter((c) => c.id !== id));
      setAllTransactions((prev) =>
        prev.map((t) =>
          t.categoryId === id
            ? { ...t, categoryId: null, categoryName: undefined, scheduleCLine: undefined }
            : t
        )
      );
      persist('Could not delete category', () => apiDelete(`/api/categories/${id}`));
    },
    [persist]
  );

  // ---- transactions ----------------------------------------------------------
  const addTransaction = useCallback(
    (data: Omit<Transaction, 'id'>) => {
      const t = withCategory({ ...data, id: newClientId('tx') }, data.categoryId ?? null);
      setAllTransactions((prev) => [t, ...prev]);
      bumpBalance(t.accountId, t.amount);
      persist('Could not save transaction', () => apiPost('/api/transactions', t));
      return t;
    },
    [withCategory, bumpBalance, persist]
  );

  const addBatchTransactions = useCallback(
    (list: Omit<Transaction, 'id'>[]) => {
      if (!list.length) return;
      const txs = list.map((d) => withCategory({ ...d, id: newClientId('tx') }, d.categoryId ?? null));
      setAllTransactions((prev) => [...txs, ...prev]);
      const deltas: Record<string, number> = {};
      txs.forEach((t) => (deltas[t.accountId] = (deltas[t.accountId] || 0) + t.amount));
      Object.entries(deltas).forEach(([acc, d]) => bumpBalance(acc, d));
      persist('Could not save imported transactions', () => apiPost('/api/transactions/batch', { transactions: txs }));
    },
    [withCategory, bumpBalance, persist]
  );

  const updateTransaction = useCallback(
    (id: string, updates: Partial<Transaction>) => {
      const cur = allTransactions.find((t) => t.id === id);
      if (!cur) return;
      const moneyChange =
        (updates.amount !== undefined && updates.amount !== cur.amount) ||
        (updates.accountId !== undefined && updates.accountId !== cur.accountId) ||
        (updates.date !== undefined && updates.date !== cur.date);
      if (cur.reconciled && moneyChange) {
        notify(
          'This transaction is part of a reconciled statement. Delete that reconciliation before changing its date, amount or account.',
          'error'
        );
        return;
      }
      let next: Transaction = { ...cur, ...updates };
      if (updates.categoryId !== undefined) {
        next = withCategory(next, updates.categoryId);
        if (updates.aiConfidence === undefined) next.aiConfidence = undefined;
        if (updates.aiReasoning === undefined) next.aiReasoning = undefined;
      }
      setAllTransactions((prev) => prev.map((t) => (t.id === id ? next : t)));
      if (next.accountId === cur.accountId) bumpBalance(cur.accountId, next.amount - cur.amount);
      else {
        bumpBalance(cur.accountId, -cur.amount);
        bumpBalance(next.accountId, next.amount);
      }
      const body: any = {};
      (['date', 'payee', 'description', 'amount', 'accountId', 'categoryId', 'notes', 'aiConfidence', 'aiReasoning'] as const).forEach(
        (k) => {
          if (updates[k] !== undefined || (k === 'categoryId' && 'categoryId' in updates)) body[k] = (updates as any)[k] ?? null;
        }
      );
      persist('Could not save changes', () => apiPatch(`/api/transactions/${id}`, body));
    },
    [allTransactions, withCategory, bumpBalance, persist, notify]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      const cur = allTransactions.find((t) => t.id === id);
      if (!cur) return;
      if (cur.reconciled) {
        notify('This transaction is part of a reconciled statement. Delete that reconciliation first.', 'error');
        return;
      }
      setAllTransactions((prev) => prev.filter((t) => t.id !== id));
      bumpBalance(cur.accountId, -cur.amount);
      persist('Could not delete transaction', () => apiDelete(`/api/transactions/${id}`));
    },
    [allTransactions, bumpBalance, persist, notify]
  );

  const categorizeTransaction = useCallback(
    (id: string, categoryId: string | null) => updateTransaction(id, { categoryId }),
    [updateTransaction]
  );

  const batchCategorizeTransactions = useCallback(
    (ids: string[], categoryId: string) => {
      if (!ids.length) return;
      const set = new Set(ids);
      setAllTransactions((prev) =>
        prev.map((t) => (set.has(t.id) ? { ...withCategory(t, categoryId), aiConfidence: undefined, aiReasoning: undefined } : t))
      );
      persist('Could not save categories', () =>
        apiPost('/api/transactions/bulk-update', { updates: ids.map((id) => ({ id, categoryId })) })
      );
    },
    [withCategory, persist]
  );

  // ---- AI categorization -------------------------------------------------------
  const autoCategorizeWithAI = useCallback(
    async (targetTxIds?: string[]) => {
      setIsAiCategorizing(true);
      try {
        const pool = (targetTxIds ? transactions.filter((t) => targetTxIds.includes(t.id)) : transactions.filter((t) => !t.categoryId)).slice(0, 500);
        if (pool.length === 0) return { updatedCount: 0, suggestions: [] };
        await queue.current; // make sure the server has everything we're about to ask about

        const data = await api('POST', '/api/ai/categorize', {
          transactions: pool.map((t) => ({ id: t.id, date: t.date, description: t.description, payee: t.payee, amount: t.amount })),
          categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type, scheduleC: c.scheduleCLine })),
          businessType: `${activeBusiness.name} (${activeBusiness.industry})`,
        });
        const suggestions: Array<{
          id: string;
          categoryId: string;
          categoryName: string;
          confidence: number;
          reasoning: string;
          scheduleCLine?: string;
        }> = data.suggestions || [];

        const map = new Map(suggestions.map((s) => [s.id, s]));
        setAllTransactions((prev) =>
          prev.map((t) => {
            const s = map.get(t.id);
            return s ? { ...withCategory(t, s.categoryId), aiConfidence: s.confidence, aiReasoning: s.reasoning } : t;
          })
        );
        if (suggestions.length) {
          persist('Could not save AI categories', () =>
            apiPost('/api/transactions/bulk-update', {
              updates: suggestions.map((s) => ({
                id: s.id,
                categoryId: s.categoryId,
                aiConfidence: s.confidence,
                aiReasoning: s.reasoning,
              })),
            })
          );
        }
        return { updatedCount: suggestions.length, suggestions };
      } finally {
        setIsAiCategorizing(false);
      }
    },
    [transactions, categories, activeBusiness, withCategory, persist]
  );

  // ---- reconciliations ---------------------------------------------------------
  const saveReconciliation = useCallback(
    (rec: Reconciliation) => {
      setAllReconciliations((prev) => [rec, ...prev.filter((r) => r.id !== rec.id)]);
      const cleared = new Set(rec.clearedTransactionIds);
      setAllTransactions((prev) =>
        prev.map((t) => {
          if (cleared.has(t.id)) return { ...t, reconciled: true, reconciliationId: rec.id };
          if (t.reconciliationId === rec.id) return { ...t, reconciled: false, reconciliationId: undefined };
          return t;
        })
      );
      persist('Could not save reconciliation', () => apiPut(`/api/reconciliations/${rec.id}`, rec));
    },
    [persist]
  );

  const deleteReconciliation = useCallback(
    (id: string) => {
      setAllReconciliations((prev) => prev.filter((r) => r.id !== id));
      setAllTransactions((prev) =>
        prev.map((t) => (t.reconciliationId === id ? { ...t, reconciled: false, reconciliationId: undefined } : t))
      );
      persist('Could not delete reconciliation', () => apiDelete(`/api/reconciliations/${id}`));
    },
    [persist]
  );

  // ---- SimpleFIN -----------------------------------------------------------------
  const connectWith = useCallback(
    async (path: 'claim' | 'connect', payload: object) => {
      setSyncError(null);
      setIsSyncing(true);
      try {
        await queue.current;
        const r = await apiPost(`/api/simplefin/${currentId}/${path}`, payload);
        setBridgeConfigs((prev) => ({ ...prev, [currentId]: r.bridgeConfig }));
        return { success: true };
      } catch (e: any) {
        setSyncError(e.message || 'SimpleFIN setup failed');
        return { success: false, error: e.message as string };
      } finally {
        setIsSyncing(false);
      }
    },
    [currentId]
  );

  const connectSimpleFinWithToken = useCallback((setupToken: string) => connectWith('claim', { setupToken }), [connectWith]);
  const connectSimpleFinAccessUrl = useCallback((accessUrl: string) => connectWith('connect', { accessUrl }), [connectWith]);

  const disconnectSimpleFin = useCallback(() => {
    setBridgeConfigs((prev) => ({
      ...prev,
      [currentId]: { businessId: currentId, accessUrl: '', isDemo: false, lastSyncedAt: null, status: 'disconnected' },
    }));
    persist('Could not disconnect SimpleFIN', () => apiDelete(`/api/simplefin/${currentId}`));
  }, [currentId, persist]);

  const syncSimpleFin = useCallback(async () => {
    if (bridgeConfig.status === 'disconnected') throw new Error('SimpleFIN is not connected for this business.');
    setIsSyncing(true);
    setSyncError(null);
    try {
      await queue.current;
      const r = await apiPost(`/api/simplefin/${currentId}/sync`);
      // swap this business's data for the server's fresh copy
      setAllAccounts((prev) => [...prev.filter((a) => a.businessId !== currentId), ...r.accounts]);
      setAllTransactions((prev) => [...prev.filter((t) => t.businessId !== currentId), ...r.transactions]);
      setBridgeConfigs((prev) => ({ ...prev, ...r.bridgeConfigs }));
      return { addedCount: r.addedCount as number, message: r.message as string };
    } catch (e: any) {
      setSyncError(e.message || 'Sync failed');
      reloadRef.current();
      throw e;
    } finally {
      setIsSyncing(false);
    }
  }, [bridgeConfig.status, currentId]);

  const value: AccountingContextType = {
    loading,
    loadError,
    reload,
    notice,
    notify,
    dismissNotice,

    businesses,
    activeBusinessId: currentId,
    activeBusiness,
    setActiveBusinessId,
    addBusiness,
    updateBusiness,
    deleteBusiness,

    accounts,
    allAccounts,
    addAccount,
    updateAccount,
    deleteAccount,

    categories,
    addCategory,
    updateCategory,
    deleteCategory,

    transactions,
    allTransactions,
    addTransaction,
    addBatchTransactions,
    updateTransaction,
    deleteTransaction,
    categorizeTransaction,
    batchCategorizeTransactions,
    autoCategorizeWithAI,
    isAiCategorizing,

    reconciliations,
    saveReconciliation,
    deleteReconciliation,

    bridgeConfig,
    connectSimpleFinWithToken,
    connectSimpleFinAccessUrl,
    disconnectSimpleFin,
    syncSimpleFin,
    isSyncing,
    syncError,
  };

  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
};

export const useAccounting = () => {
  const context = useContext(AccountingContext);
  if (!context) throw new Error('useAccounting must be used within an AccountingProvider');
  return context;
};
