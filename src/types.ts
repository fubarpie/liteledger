export type BusinessStructure =
  | 'LLC'
  | 'Sole Proprietorship'
  | 'S-Corporation'
  | 'Partnership'
  | 'C-Corporation';

export interface Business {
  id: string;
  name: string;
  legalName: string;
  structure: BusinessStructure;
  ein: string;
  industry: string;
  fiscalYearEnd: string;
  currency: string;
  color: string;
  createdDate: string;
}

export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'loan'
  | 'mortgage'
  | 'other';

export interface Account {
  id: string;
  businessId: string;
  name: string;
  type: AccountType;
  institution: string;
  accountNumberLast4: string;
  currentBalance: number;
  availableBalance?: number;
  simplefinAccountId?: string;
  lastSyncedAt?: string;
}

export type CategoryType = 'income' | 'cogs' | 'expense' | 'transfer' | 'equity';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  scheduleCLine: string;
  description?: string;
  isTaxDeductible: boolean;
  color?: string;
}

export interface Transaction {
  id: string;
  businessId: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  payee: string;
  description: string;
  amount: number; // positive = inflow/deposit, negative = outflow/charge
  categoryId: string | null;
  categoryName?: string;
  reconciled: boolean;
  reconciliationId?: string;
  source: 'simplefin' | 'manual' | 'csv_import';
  notes?: string;
  aiConfidence?: number;
  aiReasoning?: string;
  scheduleCLine?: string;
}

export interface Reconciliation {
  id: string;
  businessId: string;
  accountId: string;
  statementDate: string;
  statementBeginningBalance: number;
  statementEndingBalance: number;
  clearedDepositsCount: number;
  clearedDepositsTotal: number;
  clearedWithdrawalsCount: number;
  clearedWithdrawalsTotal: number;
  clearedBalance: number;
  difference: number;
  status: 'reconciled' | 'draft';
  reconciledAt?: string;
  clearedTransactionIds: string[];
  notes?: string;
}

export interface SimpleFinBridgeConfig {
  businessId: string;
  accessUrl: string;
  isDemo: boolean;
  lastSyncedAt: string | null;
  status: 'connected' | 'disconnected' | 'error';
  errorMessage?: string;
}
