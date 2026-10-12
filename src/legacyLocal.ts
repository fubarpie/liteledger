// Detects data left in the browser by the old localStorage-only version of the app.
import type { Business, Account, Category, Transaction, Reconciliation } from './types.ts';

export const LEGACY_KEYS = {
  businesses: 'liteledger_businesses_v1',
  accounts: 'liteledger_accounts_v1',
  categories: 'liteledger_categories_v1',
  transactions: 'liteledger_transactions_v1',
  reconciliations: 'liteledger_reconciliations_v1',
} as const;

export interface LegacyBrowserData {
  businesses: Business[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  reconciliations: Reconciliation[];
  counts: {
    businesses: number;
    accounts: number;
    categories: number;
    transactions: number;
    reconciliations: number;
  };
}

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Returns the old browser-only data, or null when there is no business to import. */
export function readLegacyBrowserData(): LegacyBrowserData | null {
  const businesses = readArray<Business>(LEGACY_KEYS.businesses);
  if (businesses.length === 0) return null;
  const accounts = readArray<Account>(LEGACY_KEYS.accounts);
  const categories = readArray<Category>(LEGACY_KEYS.categories);
  const transactions = readArray<Transaction>(LEGACY_KEYS.transactions);
  const reconciliations = readArray<Reconciliation>(LEGACY_KEYS.reconciliations);
  return {
    businesses,
    accounts,
    categories,
    transactions,
    reconciliations,
    counts: {
      businesses: businesses.length,
      accounts: accounts.length,
      categories: categories.length,
      transactions: transactions.length,
      reconciliations: reconciliations.length,
    },
  };
}

/** Remove the old browser-only data (including pre-rename variants). */
export function clearLegacyBrowserData(): void {
  try {
    const legacyPrefix = ['kite', 'books_'].join('');
    for (const key of Object.values(LEGACY_KEYS)) {
      localStorage.removeItem(key);
      localStorage.removeItem(legacyPrefix + key.slice('liteledger_'.length));
    }
  } catch {
    /* ignore */
  }
}
