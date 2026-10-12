import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

export const db = new DatabaseSync(path.join(DATA_DIR, "liteledger.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec("PRAGMA synchronous = NORMAL;");

// ---------------------------------------------------------------------------
// Migrations: append-only list. Each runs once, in order, inside a transaction.
// ---------------------------------------------------------------------------
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  CREATE TABLE businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT NOT NULL DEFAULT '',
    structure TEXT NOT NULL DEFAULT 'LLC',
    ein TEXT NOT NULL DEFAULT '',
    industry TEXT NOT NULL DEFAULT '',
    fiscal_year_end TEXT NOT NULL DEFAULT '12-31',
    currency TEXT NOT NULL DEFAULT 'USD',
    color TEXT NOT NULL DEFAULT 'indigo',
    created_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'checking',
    institution TEXT NOT NULL DEFAULT '',
    last4 TEXT NOT NULL DEFAULT '',
    current_balance INTEGER NOT NULL DEFAULT 0,   -- cents
    available_balance INTEGER,                     -- cents
    simplefin_account_id TEXT,
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_accounts_business ON accounts(business_id);

  CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    schedule_c_line TEXT NOT NULL DEFAULT '',
    description TEXT,
    is_tax_deductible INTEGER NOT NULL DEFAULT 0,
    color TEXT,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_categories_business ON categories(business_id);

  CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    payee TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    amount INTEGER NOT NULL,                       -- cents, + inflow / - outflow
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    reconciled INTEGER NOT NULL DEFAULT 0,
    reconciliation_id TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    notes TEXT,
    ai_confidence REAL,
    ai_reasoning TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_tx_business_date ON transactions(business_id, date);
  CREATE INDEX idx_tx_account ON transactions(account_id);
  CREATE UNIQUE INDEX idx_tx_external ON transactions(account_id, external_id) WHERE external_id IS NOT NULL;

  CREATE TABLE reconciliations (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    statement_date TEXT NOT NULL,
    status TEXT NOT NULL,
    data TEXT NOT NULL                              -- full JSON record
  );
  CREATE INDEX idx_rec_business ON reconciliations(business_id);

  CREATE TABLE bridge_configs (
    business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    access_url_enc TEXT NOT NULL,
    last_synced_at TEXT,
    status TEXT NOT NULL DEFAULT 'connected',
    error_message TEXT
  );
  `,
];

function migrate() {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)");
  const row = db.prepare("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations").get() as { v: number };
  for (let i = row.v; i < MIGRATIONS.length; i++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[i]);
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(i + 1);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}
migrate();

/** Run fn inside a transaction; rolls back on throw. */
export function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export const toCents = (n: number) => Math.round(Number(n) * 100);
export const fromCents = (c: number | null | undefined) => (c === null || c === undefined ? undefined : c / 100);
