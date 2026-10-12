import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Business,
  Account,
  Category,
  Transaction,
  Reconciliation,
  SimpleFinBridgeConfig,
} from '../types.ts';
import {
  DEFAULT_CATEGORIES,
  INITIAL_BUSINESSES,
  INITIAL_ACCOUNTS,
  INITIAL_TRANSACTIONS,
  INITIAL_RECONCILIATIONS,
  INITIAL_BRIDGE_CONFIGS,
} from '../data/initialData.ts';

interface AccountingContextType {
  // Business
  businesses: Business[];
  activeBusinessId: string;
  activeBusiness: Business;
  setActiveBusinessId: (id: string) => void;
  addBusiness: (biz: Omit<Business, 'id' | 'createdDate'>) => Business;
  updateBusiness: (id: string, updates: Partial<Business>) => void;
  deleteBusiness: (id: string) => void;

  // Accounts
  accounts: Account[];
  allAccounts: Account[];
  addAccount: (account: Omit<Account, 'id'>) => Account;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Categories
  categories: Category[];
  addCategory: (cat: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => void;

  // Transactions
  transactions: Transaction[];
  allTransactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id'>) => Transaction;
  addBatchTransactions: (txs: Omit<Transaction, 'id'>[]) => void;
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

  // SimpleFIN
  bridgeConfig: SimpleFinBridgeConfig;
  connectSimpleFinWithToken: (setupToken: string) => Promise<{ success: boolean; error?: string }>;
  connectSimpleFinAccessUrl: (accessUrl: string, isDemo?: boolean) => void;
  disconnectSimpleFin: () => void;
  syncSimpleFin: () => Promise<{ addedCount: number; message: string }>;
  isSyncing: boolean;
  syncError: string | null;

  // Utility
  resetAllToDefaults: () => void;
}

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

const STORAGE_KEYS = {
  BUSINESSES: 'liteledger_businesses_v1',
  ACTIVE_BIZ: 'liteledger_active_biz_v1',
  ACCOUNTS: 'liteledger_accounts_v1',
  CATEGORIES: 'liteledger_categories_v1',
  TRANSACTIONS: 'liteledger_transactions_v1',
  RECONCILIATIONS: 'liteledger_reconciliations_v1',
  BRIDGE_CONFIGS: 'liteledger_bridge_configs_v1',
};

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Businesses
  const [businesses, setBusinesses] = useState<Business[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BUSINESSES);
      return saved ? JSON.parse(saved) : INITIAL_BUSINESSES;
    } catch {
      return INITIAL_BUSINESSES;
    }
  });

  const [activeBusinessId, setActiveBusinessIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_BIZ);
      if (saved && businesses.some((b) => b.id === saved)) return saved;
      return businesses[0]?.id || 'biz_woodworks';
    } catch {
      return 'biz_woodworks';
    }
  });

  // 2. Accounts
  const [allAccounts, setAllAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
    } catch {
      return INITIAL_ACCOUNTS;
    }
  });

  // 3. Categories
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  // 4. Transactions
  const [allTransactions, setAllTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  // 5. Reconciliations
  const [allReconciliations, setAllReconciliations] = useState<Reconciliation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECONCILIATIONS);
      return saved ? JSON.parse(saved) : INITIAL_RECONCILIATIONS;
    } catch {
      return INITIAL_RECONCILIATIONS;
    }
  });

  // 6. SimpleFIN Bridge Configs
  const [bridgeConfigs, setBridgeConfigs] = useState<Record<string, SimpleFinBridgeConfig>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BRIDGE_CONFIGS);
      return saved ? JSON.parse(saved) : INITIAL_BRIDGE_CONFIGS;
    } catch {
      return INITIAL_BRIDGE_CONFIGS;
    }
  });

  const [isAiCategorizing, setIsAiCategorizing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
  }, [businesses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_BIZ, activeBusinessId);
  }, [activeBusinessId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(allAccounts));
  }, [allAccounts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(allTransactions));
  }, [allTransactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECONCILIATIONS, JSON.stringify(allReconciliations));
  }, [allReconciliations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BRIDGE_CONFIGS, JSON.stringify(bridgeConfigs));
  }, [bridgeConfigs]);

  // Derived active objects
  const activeBusiness = useMemo(() => {
    return businesses.find((b) => b.id === activeBusinessId) || businesses[0] || INITIAL_BUSINESSES[0];
  }, [businesses, activeBusinessId]);

  const accounts = useMemo(() => {
    return allAccounts.filter((a) => a.businessId === activeBusinessId);
  }, [allAccounts, activeBusinessId]);

  const transactions = useMemo(() => {
    return allTransactions
      .filter((t) => t.businessId === activeBusinessId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTransactions, activeBusinessId]);

  const reconciliations = useMemo(() => {
    return allReconciliations
      .filter((r) => r.businessId === activeBusinessId)
      .sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime());
  }, [allReconciliations, activeBusinessId]);

  const bridgeConfig = useMemo<SimpleFinBridgeConfig>(() => {
    return (
      bridgeConfigs[activeBusinessId] || {
        businessId: activeBusinessId,
        accessUrl: '',
        isDemo: false,
        lastSyncedAt: null,
        status: 'disconnected',
      }
    );
  }, [bridgeConfigs, activeBusinessId]);

  // Switch Active Business
  const setActiveBusinessId = useCallback((id: string) => {
    setActiveBusinessIdState(id);
    setSyncError(null);
  }, []);

  // Business CRUD
  const addBusiness = useCallback(
    (bizData: Omit<Business, 'id' | 'createdDate'>) => {
      const newId = `biz_${Date.now()}`;
      const newBiz: Business = {
        ...bizData,
        id: newId,
        createdDate: new Date().toISOString().split('T')[0],
      };
      setBusinesses((prev) => [...prev, newBiz]);
      setActiveBusinessIdState(newId);

      // Create default checking account for the new business
      const defaultAccount: Account = {
        id: `act_${Date.now()}_chk`,
        businessId: newId,
        name: 'Operating Checking',
        type: 'checking',
        institution: 'Primary Bank',
        accountNumberLast4: '1001',
        currentBalance: 0,
        availableBalance: 0,
      };
      setAllAccounts((prev) => [...prev, defaultAccount]);
      return newBiz;
    },
    []
  );

  const updateBusiness = useCallback((id: string, updates: Partial<Business>) => {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  }, []);

  const deleteBusiness = useCallback(
    (id: string) => {
      if (businesses.length <= 1) {
        alert('You must have at least one business in your software.');
        return;
      }
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      setAllAccounts((prev) => prev.filter((a) => a.businessId !== id));
      setAllTransactions((prev) => prev.filter((t) => t.businessId !== id));
      setAllReconciliations((prev) => prev.filter((r) => r.businessId !== id));
      const nextBiz = businesses.find((b) => b.id !== id);
      if (nextBiz) setActiveBusinessIdState(nextBiz.id);
    },
    [businesses]
  );

  // Accounts CRUD
  const addAccount = useCallback((accountData: Omit<Account, 'id'>) => {
    const newAccount: Account = {
      ...accountData,
      id: `act_${Date.now()}`,
    };
    setAllAccounts((prev) => [...prev, newAccount]);
    return newAccount;
  }, []);

  const updateAccount = useCallback((id: string, updates: Partial<Account>) => {
    setAllAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const deleteAccount = useCallback((id: string) => {
    setAllAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Categories CRUD
  const addCategory = useCallback((catData: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...catData,
      id: `cat_${Date.now()}`,
    };
    setCategories((prev) => [...prev, newCat]);
    return newCat;
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  // Transactions CRUD
  const addTransaction = useCallback((txData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...txData,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setAllTransactions((prev) => [newTx, ...prev]);

    // Update account balance
    setAllAccounts((prev) =>
      prev.map((act) => {
        if (act.id === txData.accountId) {
          return {
            ...act,
            currentBalance: Number((act.currentBalance + txData.amount).toFixed(2)),
          };
        }
        return act;
      })
    );

    return newTx;
  }, []);

  const addBatchTransactions = useCallback(
    (txsData: Omit<Transaction, 'id'>[]) => {
      const newTxs: Transaction[] = txsData.map((t, idx) => ({
        ...t,
        id: `tx_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      }));

      setAllTransactions((prev) => [...newTxs, ...prev]);

      // Adjust account balances
      const balanceDeltas: Record<string, number> = {};
      newTxs.forEach((t) => {
        balanceDeltas[t.accountId] = (balanceDeltas[t.accountId] || 0) + t.amount;
      });

      setAllAccounts((prev) =>
        prev.map((act) => {
          if (balanceDeltas[act.id]) {
            return {
              ...act,
              currentBalance: Number((act.currentBalance + balanceDeltas[act.id]).toFixed(2)),
            };
          }
          return act;
        })
      );
    },
    []
  );

  const updateTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    setAllTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setAllTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const categorizeTransaction = useCallback(
    (id: string, categoryId: string | null) => {
      const cat = categories.find((c) => c.id === categoryId);
      setAllTransactions((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                categoryId,
                categoryName: cat?.name || undefined,
                scheduleCLine: cat?.scheduleCLine || undefined,
              }
            : t
        )
      );
    },
    [categories]
  );

  const batchCategorizeTransactions = useCallback(
    (ids: string[], categoryId: string) => {
      const cat = categories.find((c) => c.id === categoryId);
      const idSet = new Set(ids);
      setAllTransactions((prev) =>
        prev.map((t) =>
          idSet.has(t.id)
            ? {
                ...t,
                categoryId,
                categoryName: cat?.name || undefined,
                scheduleCLine: cat?.scheduleCLine || undefined,
              }
            : t
        )
      );
    },
    [categories]
  );

  // AI Auto-Categorization
  const autoCategorizeWithAI = useCallback(
    async (targetTxIds?: string[]) => {
      setIsAiCategorizing(true);
      try {
        const txPool = targetTxIds
          ? transactions.filter((t) => targetTxIds.includes(t.id))
          : transactions.filter((t) => !t.categoryId);

        if (txPool.length === 0) {
          setIsAiCategorizing(false);
          return { updatedCount: 0, suggestions: [] };
        }

        const res = await fetch('/api/ai/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactions: txPool,
            categories: categories.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              scheduleC: c.scheduleCLine,
            })),
            businessType: `${activeBusiness.name} (${activeBusiness.industry})`,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to auto-categorize: ${res.statusText}`);
        }

        const data = await res.json();
        const suggestions: Array<{
          id: string;
          categoryId: string;
          categoryName: string;
          confidence: number;
          reasoning: string;
          scheduleCLine?: string;
        }> = data.suggestions || [];

        // Apply suggestions
        const suggestionMap = new Map(suggestions.map((s) => [s.id, s]));

        setAllTransactions((prev) =>
          prev.map((t) => {
            const suggestion = suggestionMap.get(t.id);
            if (suggestion) {
              const matchedCat = categories.find((c) => c.id === suggestion.categoryId);
              return {
                ...t,
                categoryId: matchedCat ? matchedCat.id : suggestion.categoryId,
                categoryName: matchedCat ? matchedCat.name : suggestion.categoryName,
                scheduleCLine: matchedCat ? matchedCat.scheduleCLine : suggestion.scheduleCLine,
                aiConfidence: suggestion.confidence,
                aiReasoning: suggestion.reasoning,
              };
            }
            return t;
          })
        );

        return { updatedCount: suggestions.length, suggestions };
      } catch (err: any) {
        console.error('AI Categorization failed:', err);
        throw err;
      } finally {
        setIsAiCategorizing(false);
      }
    },
    [transactions, categories, activeBusiness]
  );

  // Reconciliations
  const saveReconciliation = useCallback(
    (rec: Reconciliation) => {
      setAllReconciliations((prev) => {
        const filtered = prev.filter((r) => r.id !== rec.id);
        return [rec, ...filtered];
      });

      // Mark cleared transactions
      const clearedSet = new Set(rec.clearedTransactionIds);
      setAllTransactions((prev) =>
        prev.map((t) => {
          if (clearedSet.has(t.id)) {
            return {
              ...t,
              reconciled: true,
              reconciliationId: rec.id,
            };
          }
          return t;
        })
      );
    },
    []
  );

  const deleteReconciliation = useCallback((id: string) => {
    setAllReconciliations((prev) => prev.filter((r) => r.id !== id));
    // Unmark transactions
    setAllTransactions((prev) =>
      prev.map((t) => (t.reconciliationId === id ? { ...t, reconciled: false, reconciliationId: undefined } : t))
    );
  }, []);

  // SimpleFIN Integration
  const connectSimpleFinWithToken = useCallback(
    async (setupToken: string) => {
      setSyncError(null);
      setIsSyncing(true);
      try {
        const res = await fetch('/api/simplefin/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setupToken }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to claim SimpleFIN token');
        }

        const newConfig: SimpleFinBridgeConfig = {
          businessId: activeBusinessId,
          accessUrl: data.accessUrl,
          isDemo: Boolean(data.isDemo),
          lastSyncedAt: null,
          status: 'connected',
        };

        setBridgeConfigs((prev) => ({
          ...prev,
          [activeBusinessId]: newConfig,
        }));

        setIsSyncing(false);
        return { success: true };
      } catch (err: any) {
        setSyncError(err.message || 'SimpleFIN setup failed');
        setIsSyncing(false);
        return { success: false, error: err.message };
      }
    },
    [activeBusinessId]
  );

  const connectSimpleFinAccessUrl = useCallback(
    (accessUrl: string, isDemo: boolean = false) => {
      setBridgeConfigs((prev) => ({
        ...prev,
        [activeBusinessId]: {
          businessId: activeBusinessId,
          accessUrl,
          isDemo,
          lastSyncedAt: null,
          status: 'connected',
        },
      }));
      setSyncError(null);
    },
    [activeBusinessId]
  );

  const disconnectSimpleFin = useCallback(() => {
    setBridgeConfigs((prev) => ({
      ...prev,
      [activeBusinessId]: {
        businessId: activeBusinessId,
        accessUrl: '',
        isDemo: false,
        lastSyncedAt: null,
        status: 'disconnected',
      },
    }));
  }, [activeBusinessId]);

  const syncSimpleFin = useCallback(async () => {
    const config = bridgeConfigs[activeBusinessId];
    if (!config || !config.accessUrl) {
      throw new Error('SimpleFIN is not connected for this business.');
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const res = await fetch('/api/simplefin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessUrl: config.accessUrl,
          isDemo: config.isDemo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync with SimpleFIN');
      }

      const sfinAccounts: any[] = data.accounts || [];
      let newTransactionsCount = 0;

      // Map or create accounts
      const existingAccountMap = new Map(
        allAccounts
          .filter((a) => a.businessId === activeBusinessId)
          .map((a) => [a.simplefinAccountId || a.id, a])
      );

      const updatedAccountsList = [...allAccounts];
      const newTransactionsToAdd: Omit<Transaction, 'id'>[] = [];

      for (const sAccount of sfinAccounts) {
        let localAccount = existingAccountMap.get(sAccount.id);

        const parsedBalance = parseFloat(sAccount.balance || '0');
        const parsedAvailable = parseFloat(sAccount['available-balance'] || sAccount.balance || '0');

        if (localAccount) {
          // Update existing account balance
          const idx = updatedAccountsList.findIndex((a) => a.id === localAccount?.id);
          if (idx !== -1) {
            updatedAccountsList[idx] = {
              ...updatedAccountsList[idx],
              currentBalance: parsedBalance,
              availableBalance: parsedAvailable,
              lastSyncedAt: new Date().toISOString(),
            };
          }
        } else {
          // Detect type
          const nameLower = (sAccount.name || '').toLowerCase();
          let accType: Account['type'] = 'checking';
          if (nameLower.includes('credit') || nameLower.includes('card') || nameLower.includes('visa')) {
            accType = 'credit_card';
          } else if (nameLower.includes('savings')) {
            accType = 'savings';
          } else if (nameLower.includes('mortgage')) {
            accType = 'mortgage';
          } else if (nameLower.includes('loan')) {
            accType = 'loan';
          }

          const createdAccount: Account = {
            id: `act_sfin_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            businessId: activeBusinessId,
            name: sAccount.name || 'Synced Account',
            type: accType,
            institution: sAccount.org?.name || 'Bank',
            accountNumberLast4: sAccount.id.slice(-4),
            currentBalance: parsedBalance,
            availableBalance: parsedAvailable,
            simplefinAccountId: sAccount.id,
            lastSyncedAt: new Date().toISOString(),
          };

          updatedAccountsList.push(createdAccount);
          localAccount = createdAccount;
        }

        // Import transactions
        const existingTxDescriptions = new Set(
          allTransactions
            .filter((t) => t.businessId === activeBusinessId && t.accountId === localAccount?.id)
            .map((t) => `${t.date}_${t.amount}_${t.description}`)
        );

        if (Array.isArray(sAccount.transactions)) {
          for (const sTx of sAccount.transactions) {
            const txDate = sTx.posted
              ? new Date(sTx.posted * 1000).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0];
            const txAmount = parseFloat(sTx.amount || '0');
            const txDesc = sTx.description || sTx.memo || 'Bank Transaction';
            const sigKey = `${txDate}_${txAmount}_${txDesc}`;

            if (!existingTxDescriptions.has(sigKey)) {
              newTransactionsToAdd.push({
                businessId: activeBusinessId,
                accountId: localAccount.id,
                date: txDate,
                payee: sTx.payee || txDesc,
                description: txDesc,
                amount: txAmount,
                categoryId: null, // Uncategorized, ready for AI
                reconciled: false,
                source: 'simplefin',
                notes: sTx.memo,
              });
              newTransactionsCount++;
            }
          }
        }
      }

      setAllAccounts(updatedAccountsList);
      if (newTransactionsToAdd.length > 0) {
        addBatchTransactions(newTransactionsToAdd);
      }

      // Update bridge config synced time
      setBridgeConfigs((prev) => ({
        ...prev,
        [activeBusinessId]: {
          ...config,
          lastSyncedAt: new Date().toISOString(),
          status: 'connected',
        },
      }));

      setIsSyncing(false);
      return {
        addedCount: newTransactionsCount,
        message: `Synced ${sfinAccounts.length} accounts. Imported ${newTransactionsCount} new transactions.`,
      };
    } catch (err: any) {
      setSyncError(err.message || 'Sync failed');
      setIsSyncing(false);
      throw err;
    }
  }, [bridgeConfigs, activeBusinessId, allAccounts, allTransactions, addBatchTransactions]);

  const resetAllToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.BUSINESSES);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_BIZ);
    localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.RECONCILIATIONS);
    localStorage.removeItem(STORAGE_KEYS.BRIDGE_CONFIGS);

    setBusinesses(INITIAL_BUSINESSES);
    setActiveBusinessIdState(INITIAL_BUSINESSES[0].id);
    setAllAccounts(INITIAL_ACCOUNTS);
    setCategories(DEFAULT_CATEGORIES);
    setAllTransactions(INITIAL_TRANSACTIONS);
    setAllReconciliations(INITIAL_RECONCILIATIONS);
    setBridgeConfigs(INITIAL_BRIDGE_CONFIGS);
  }, []);

  const value = {
    businesses,
    activeBusinessId,
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

    resetAllToDefaults,
  };

  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
};

export const useAccounting = () => {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccounting must be used within an AccountingProvider');
  }
  return context;
};
