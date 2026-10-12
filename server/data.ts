import { Router } from "express";
import { db, tx, toCents, fromCents } from "./db.ts";
import { requireAuth, requireAdmin } from "./auth.ts";
import { HttpError, ah, str, num, date, oneOf, id as idv } from "./util.ts";
import { newId } from "./security.ts";
import { DEFAULT_CATEGORIES } from "./defaultCategories.ts";

export const dataRouter = Router();
dataRouter.use(requireAuth);

const STRUCTURES = ["LLC", "Sole Proprietorship", "S-Corporation", "Partnership", "C-Corporation"] as const;
const ACCOUNT_TYPES = ["checking", "savings", "credit_card", "loan", "mortgage", "other"] as const;
const CATEGORY_TYPES = ["income", "cogs", "expense", "transfer", "equity"] as const;
const SOURCES = ["simplefin", "manual", "csv_import"] as const;

type Row = Record<string, any>;
const q = (sql: string) => db.prepare(sql);
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as T;

// ---------------------------------------------------------------------------
// Row -> API mappers
// ---------------------------------------------------------------------------
export const bizOut = (r: Row) => ({
  id: r.id, name: r.name, legalName: r.legal_name, structure: r.structure, ein: r.ein, industry: r.industry,
  fiscalYearEnd: r.fiscal_year_end, currency: r.currency, color: r.color, createdDate: r.created_date,
});
export const acctOut = (r: Row) => clean({
  id: r.id, businessId: r.business_id, name: r.name, type: r.type, institution: r.institution,
  accountNumberLast4: r.last4, currentBalance: fromCents(r.current_balance) ?? 0,
  availableBalance: fromCents(r.available_balance), simplefinAccountId: r.simplefin_account_id, lastSyncedAt: r.last_synced_at,
});
export const catOut = (r: Row) => clean({
  id: r.id, businessId: r.business_id, name: r.name, type: r.type, scheduleCLine: r.schedule_c_line,
  description: r.description, isTaxDeductible: !!r.is_tax_deductible, color: r.color,
});
const TX_SELECT = `SELECT t.*, c.name AS category_name, c.schedule_c_line AS category_line
                   FROM transactions t LEFT JOIN categories c ON c.id = t.category_id`;
export const txOut = (r: Row) => ({ ...clean({
  id: r.id, businessId: r.business_id, accountId: r.account_id, date: r.date, payee: r.payee, description: r.description,
  amount: fromCents(r.amount) ?? 0, categoryName: r.category_name, reconciled: !!r.reconciled,
  reconciliationId: r.reconciliation_id, source: r.source, notes: r.notes,
  aiConfidence: r.ai_confidence, aiReasoning: r.ai_reasoning, scheduleCLine: r.category_line,
}), categoryId: (r.category_id ?? null) as string | null });
const getTx = (txId: string) => {
  const r = q(`${TX_SELECT} WHERE t.id = ?`).get(txId);
  return r ? txOut(r) : null;
};

function bridgeOut(businessId: string) {
  const r = q("SELECT * FROM bridge_configs WHERE business_id = ?").get(businessId) as Row | undefined;
  return {
    businessId,
    // The access URL never leaves the server; the client only learns that one exists.
    accessUrl: r ? "configured" : "",
    isDemo: false,
    lastSyncedAt: r?.last_synced_at ?? null,
    status: r ? r.status : "disconnected",
    ...(r?.error_message ? { errorMessage: r.error_message } : {}),
  };
}

export function loadBusinessState(businessId?: string) {
  const w = businessId ? " WHERE business_id = ?" : "";
  const args = businessId ? [businessId] : [];
  const businesses = (businessId ? q("SELECT * FROM businesses WHERE id = ?") : q("SELECT * FROM businesses ORDER BY created_at, rowid")).all(...args);
  return {
    businesses: businesses.map(bizOut),
    accounts: q(`SELECT * FROM accounts${w} ORDER BY created_at, rowid`).all(...args).map(acctOut),
    categories: q(`SELECT * FROM categories${w} ORDER BY sort, rowid`).all(...args).map(catOut),
    transactions: db.prepare(`${TX_SELECT}${businessId ? " WHERE t.business_id = ?" : ""} ORDER BY t.date DESC, t.created_at DESC`).all(...args).map(txOut),
    reconciliations: q(`SELECT data FROM reconciliations${w} ORDER BY statement_date DESC`).all(...args).map((r: any) => JSON.parse(r.data)),
    bridgeConfigs: Object.fromEntries(businesses.map((b: any) => [b.id, bridgeOut(b.id)])),
  };
}

dataRouter.get("/bootstrap", ah(async (_req, res) => res.json(loadBusinessState())));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureBusiness(businessId: string) {
  if (!q("SELECT 1 FROM businesses WHERE id = ?").get(businessId)) throw new HttpError(404, "Business not found");
}
function freshId(table: string, prefix: string, wanted: unknown): string {
  const i = wanted === undefined || wanted === null ? newId(prefix) : idv(wanted);
  if (q(`SELECT 1 FROM ${table} WHERE id = ?`).get(i)) throw new HttpError(409, `${prefix} id already exists`);
  return i;
}
const adjustBalance = (accountId: string, deltaCents: number) =>
  q("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?").run(deltaCents, accountId);

export function seedCategories(businessId: string) {
  const ins = q(
    `INSERT INTO categories (id, business_id, name, type, schedule_c_line, description, is_tax_deductible, color, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  DEFAULT_CATEGORIES.forEach((c, i) =>
    ins.run(newId("cat"), businessId, c.name, c.type, c.scheduleCLine, c.description ?? null, c.isTaxDeductible ? 1 : 0, c.color ?? null, i)
  );
}

// ---------------------------------------------------------------------------
// Category templates (for onboarding)
// ---------------------------------------------------------------------------
dataRouter.get("/category-templates", ah(async (_req, res) => {
  res.json({
    templates: [
      { key: "schedule-c", name: "General small business (IRS Schedule C)", description: "Income, cost of goods, and the standard Schedule C expense lines.", count: DEFAULT_CATEGORIES.length },
      { key: "none", name: "Start empty", description: "No categories - build your own chart of accounts.", count: 0 },
    ],
  });
}));

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------
function parseBusiness(b: any, partial: boolean) {
  const out: Row = {};
  const has = (k: string) => !partial || b?.[k] !== undefined;
  if (has("name")) out.name = str(b?.name, "Business name", 120);
  if (has("legalName")) out.legal_name = str(b?.legalName, "Legal name", 160, { optional: true });
  if (has("structure")) out.structure = oneOf(b?.structure ?? "LLC", "structure", STRUCTURES);
  if (has("ein")) out.ein = str(b?.ein, "EIN", 20, { optional: true });
  if (has("industry")) out.industry = str(b?.industry, "Industry", 120, { optional: true });
  if (has("fiscalYearEnd")) out.fiscal_year_end = str(b?.fiscalYearEnd ?? "12-31", "Fiscal year end", 10);
  if (has("currency")) out.currency = str(b?.currency ?? "USD", "Currency", 6);
  if (has("color")) out.color = str(b?.color ?? "indigo", "Color", 20);
  return out;
}

function parseAccount(a: any, partial: boolean) {
  const out: Row = {};
  const has = (k: string) => !partial || a?.[k] !== undefined;
  if (has("name")) out.name = str(a?.name, "Account name", 120);
  if (has("type")) out.type = oneOf(a?.type ?? "checking", "Account type", ACCOUNT_TYPES);
  if (has("institution")) out.institution = str(a?.institution, "Institution", 120, { optional: true });
  if (has("accountNumberLast4")) out.last4 = str(a?.accountNumberLast4, "Last 4", 8, { optional: true });
  if (has("currentBalance")) out.current_balance = toCents(num(a?.currentBalance ?? 0, "Balance"));
  if (a?.availableBalance !== undefined && a.availableBalance !== null) out.available_balance = toCents(num(a.availableBalance, "Available balance"));
  return out;
}

function insertAccount(businessId: string, a: any) {
  const f = parseAccount(a, false);
  const accId = freshId("accounts", "act", a?.id);
  q(
    `INSERT INTO accounts (id, business_id, name, type, institution, last4, current_balance, available_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(accId, businessId, f.name, f.type, f.institution, f.last4, f.current_balance, f.available_balance ?? null);
  return accId;
}

dataRouter.post("/businesses", ah(async (req, res) => {
  const f = parseBusiness(req.body, false);
  const templateKey = req.body?.categoryTemplate === "none" ? "none" : "schedule-c";
  const accountsIn: any[] = Array.isArray(req.body?.accounts) ? req.body.accounts.slice(0, 50) : [];
  const bizId = tx(() => {
    const bid = freshId("businesses", "biz", req.body?.id);
    q(
      `INSERT INTO businesses (id, name, legal_name, structure, ein, industry, fiscal_year_end, currency, color, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(bid, f.name, f.legal_name, f.structure, f.ein, f.industry, f.fiscal_year_end, f.currency, f.color, new Date().toISOString().slice(0, 10));
    if (templateKey !== "none") seedCategories(bid);
    for (const a of accountsIn) insertAccount(bid, { ...a, id: undefined });
    return bid;
  });
  res.status(201).json(loadBusinessState(bizId));
}));

dataRouter.patch("/businesses/:id", ah(async (req, res) => {
  ensureBusiness(req.params.id);
  const f = parseBusiness(req.body, true);
  const cols = Object.keys(f);
  if (cols.length) q(`UPDATE businesses SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...cols.map((c) => f[c]), req.params.id);
  res.json({ business: bizOut(q("SELECT * FROM businesses WHERE id = ?").get(req.params.id) as Row) });
}));

dataRouter.delete("/businesses/:id", requireAdmin, ah(async (req, res) => {
  ensureBusiness(req.params.id);
  q("DELETE FROM businesses WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
dataRouter.post("/accounts", ah(async (req, res) => {
  const businessId = idv(req.body?.businessId, "businessId");
  ensureBusiness(businessId);
  const accId = tx(() => insertAccount(businessId, req.body));
  res.status(201).json({ account: acctOut(q("SELECT * FROM accounts WHERE id = ?").get(accId) as Row) });
}));

dataRouter.patch("/accounts/:id", ah(async (req, res) => {
  if (!q("SELECT 1 FROM accounts WHERE id = ?").get(req.params.id)) throw new HttpError(404, "Account not found");
  const f = parseAccount(req.body, true);
  const cols = Object.keys(f);
  if (cols.length) q(`UPDATE accounts SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...cols.map((c) => f[c]), req.params.id);
  res.json({ account: acctOut(q("SELECT * FROM accounts WHERE id = ?").get(req.params.id) as Row) });
}));

dataRouter.delete("/accounts/:id", ah(async (req, res) => {
  if (!q("SELECT 1 FROM accounts WHERE id = ?").get(req.params.id)) throw new HttpError(404, "Account not found");
  q("DELETE FROM accounts WHERE id = ?").run(req.params.id); // cascades to its transactions
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
function parseCategory(c: any, partial: boolean) {
  const out: Row = {};
  const has = (k: string) => !partial || c?.[k] !== undefined;
  if (has("name")) out.name = str(c?.name, "Category name", 120);
  if (has("type")) out.type = oneOf(c?.type, "Category type", CATEGORY_TYPES);
  if (has("scheduleCLine")) out.schedule_c_line = str(c?.scheduleCLine, "Tax line", 160, { optional: true });
  if (c?.description !== undefined) out.description = str(c.description, "Description", 400, { optional: true }) || null;
  if (has("isTaxDeductible")) out.is_tax_deductible = c?.isTaxDeductible ? 1 : 0;
  if (c?.color !== undefined) out.color = str(c.color, "Color", 20, { optional: true }) || null;
  return out;
}

dataRouter.post("/categories", ah(async (req, res) => {
  const businessId = idv(req.body?.businessId, "businessId");
  ensureBusiness(businessId);
  const f = parseCategory(req.body, false);
  const cid = freshId("categories", "cat", req.body?.id);
  const sort = (q("SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM categories WHERE business_id = ?").get(businessId) as any).s;
  q(
    `INSERT INTO categories (id, business_id, name, type, schedule_c_line, description, is_tax_deductible, color, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(cid, businessId, f.name, f.type, f.schedule_c_line, f.description ?? null, f.is_tax_deductible, f.color ?? null, sort);
  res.status(201).json({ category: catOut(q("SELECT * FROM categories WHERE id = ?").get(cid) as Row) });
}));

dataRouter.patch("/categories/:id", ah(async (req, res) => {
  if (!q("SELECT 1 FROM categories WHERE id = ?").get(req.params.id)) throw new HttpError(404, "Category not found");
  const f = parseCategory(req.body, true);
  const cols = Object.keys(f);
  if (cols.length) q(`UPDATE categories SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...cols.map((c) => f[c]), req.params.id);
  res.json({ category: catOut(q("SELECT * FROM categories WHERE id = ?").get(req.params.id) as Row) });
}));

dataRouter.delete("/categories/:id", ah(async (req, res) => {
  if (!q("SELECT 1 FROM categories WHERE id = ?").get(req.params.id)) throw new HttpError(404, "Category not found");
  q("DELETE FROM categories WHERE id = ?").run(req.params.id); // transactions become uncategorized
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
function checkRefs(businessId: string, accountId: string, categoryId: string | null) {
  const acc = q("SELECT business_id FROM accounts WHERE id = ?").get(accountId) as Row | undefined;
  if (!acc || acc.business_id !== businessId) throw new HttpError(400, "Account does not belong to this business");
  if (categoryId) {
    const cat = q("SELECT business_id FROM categories WHERE id = ?").get(categoryId) as Row | undefined;
    if (!cat || cat.business_id !== businessId) throw new HttpError(400, "Category does not belong to this business");
  }
}

function insertTransaction(t: any): string {
  const businessId = idv(t?.businessId, "businessId");
  const accountId = idv(t?.accountId, "accountId");
  const categoryId = t?.categoryId ? idv(t.categoryId, "categoryId") : null;
  checkRefs(businessId, accountId, categoryId);
  const amount = toCents(num(t?.amount, "Amount"));
  const txId = freshId("transactions", "tx", t?.id);
  q(
    `INSERT INTO transactions (id, business_id, account_id, date, payee, description, amount, category_id, reconciled, source, external_id, notes, ai_confidence, ai_reasoning)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
  ).run(
    txId, businessId, accountId, date(t?.date, "Date"),
    str(t?.payee, "Payee", 200, { optional: true }), str(t?.description, "Description", 500, { optional: true }),
    amount, categoryId, oneOf(t?.source ?? "manual", "source", SOURCES),
    t?.externalId ? str(t.externalId, "externalId", 200) : null,
    t?.notes ? str(t.notes, "Notes", 2000) : null,
    typeof t?.aiConfidence === "number" ? t.aiConfidence : null,
    t?.aiReasoning ? str(t.aiReasoning, "AI reasoning", 1000) : null
  );
  adjustBalance(accountId, amount);
  return txId;
}

dataRouter.post("/transactions", ah(async (req, res) => {
  const txId = tx(() => insertTransaction(req.body));
  res.status(201).json({ transaction: getTx(txId) });
}));

dataRouter.post("/transactions/batch", ah(async (req, res) => {
  const list: any[] = Array.isArray(req.body?.transactions) ? req.body.transactions : [];
  if (!list.length) throw new HttpError(400, "No transactions provided");
  if (list.length > 5000) throw new HttpError(400, "Too many transactions in one request (max 5000)");
  const ids = tx(() => list.map(insertTransaction));
  res.status(201).json({ count: ids.length, ids });
}));

dataRouter.patch("/transactions/:id", ah(async (req, res) => {
  const updated = tx(() => {
    const cur = q("SELECT * FROM transactions WHERE id = ?").get(req.params.id) as Row | undefined;
    if (!cur) throw new HttpError(404, "Transaction not found");
    const b = req.body || {};
    const next: Row = { ...cur };

    if (b.date !== undefined) next.date = date(b.date, "Date");
    if (b.payee !== undefined) next.payee = str(b.payee, "Payee", 200, { optional: true });
    if (b.description !== undefined) next.description = str(b.description, "Description", 500, { optional: true });
    if (b.amount !== undefined) next.amount = toCents(num(b.amount, "Amount"));
    if (b.accountId !== undefined) next.account_id = idv(b.accountId, "accountId");
    if (b.categoryId !== undefined) next.category_id = b.categoryId ? idv(b.categoryId, "categoryId") : null;
    if (b.notes !== undefined) next.notes = b.notes ? str(b.notes, "Notes", 2000) : null;
    if (b.aiConfidence !== undefined) next.ai_confidence = typeof b.aiConfidence === "number" ? b.aiConfidence : null;
    if (b.aiReasoning !== undefined) next.ai_reasoning = b.aiReasoning ? str(b.aiReasoning, "AI reasoning", 1000) : null;
    // Manual edits to category clear stale AI metadata unless the caller supplies it.
    if (b.categoryId !== undefined && b.aiConfidence === undefined && b.aiReasoning === undefined) {
      next.ai_confidence = null;
      next.ai_reasoning = null;
    }

    const moneyChanged = next.amount !== cur.amount || next.account_id !== cur.account_id || next.date !== cur.date;
    if (cur.reconciled && moneyChanged) {
      throw new HttpError(409, "This transaction is part of a reconciled statement. Delete that reconciliation before changing its date, amount or account.");
    }
    checkRefs(cur.business_id, next.account_id, next.category_id);

    q(
      `UPDATE transactions SET date=?, payee=?, description=?, amount=?, account_id=?, category_id=?, notes=?, ai_confidence=?, ai_reasoning=?, updated_at=datetime('now')
       WHERE id = ?`
    ).run(next.date, next.payee, next.description, next.amount, next.account_id, next.category_id, next.notes, next.ai_confidence, next.ai_reasoning, cur.id);

    // keep account balances in step with the edit
    if (next.account_id === cur.account_id) {
      if (next.amount !== cur.amount) adjustBalance(cur.account_id, next.amount - cur.amount);
    } else {
      adjustBalance(cur.account_id, -cur.amount);
      adjustBalance(next.account_id, next.amount);
    }
    return getTx(cur.id);
  });
  res.json({ transaction: updated });
}));

dataRouter.delete("/transactions/:id", ah(async (req, res) => {
  tx(() => {
    const cur = q("SELECT * FROM transactions WHERE id = ?").get(req.params.id) as Row | undefined;
    if (!cur) throw new HttpError(404, "Transaction not found");
    if (cur.reconciled) throw new HttpError(409, "This transaction is part of a reconciled statement. Delete that reconciliation first.");
    q("DELETE FROM transactions WHERE id = ?").run(cur.id);
    adjustBalance(cur.account_id, -cur.amount);
  });
  res.json({ ok: true });
}));

// Categorize many transactions at once (manual bulk action or applying AI suggestions).
dataRouter.post("/transactions/bulk-update", ah(async (req, res) => {
  const updates: any[] = Array.isArray(req.body?.updates) ? req.body.updates : [];
  if (!updates.length) throw new HttpError(400, "No updates provided");
  if (updates.length > 5000) throw new HttpError(400, "Too many updates (max 5000)");
  const upd = q("UPDATE transactions SET category_id = ?, ai_confidence = ?, ai_reasoning = ?, updated_at = datetime('now') WHERE id = ?");
  let count = 0;
  tx(() => {
    for (const u of updates) {
      const txId = idv(u?.id);
      const cur = q("SELECT business_id FROM transactions WHERE id = ?").get(txId) as Row | undefined;
      if (!cur) continue;
      const categoryId = u.categoryId ? idv(u.categoryId, "categoryId") : null;
      if (categoryId) {
        const cat = q("SELECT business_id FROM categories WHERE id = ?").get(categoryId) as Row | undefined;
        if (!cat || cat.business_id !== cur.business_id) continue;
      }
      upd.run(categoryId, typeof u.aiConfidence === "number" ? u.aiConfidence : null, u.aiReasoning ? String(u.aiReasoning).slice(0, 1000) : null, txId);
      count++;
    }
  });
  res.json({ count });
}));

// ---------------------------------------------------------------------------
// Reconciliations
// ---------------------------------------------------------------------------
dataRouter.put("/reconciliations/:id", ah(async (req, res) => {
  const rec = req.body;
  const recId = idv(req.params.id);
  const businessId = idv(rec?.businessId, "businessId");
  const accountId = idv(rec?.accountId, "accountId");
  const ids: string[] = Array.isArray(rec?.clearedTransactionIds) ? rec.clearedTransactionIds.map((x: unknown) => idv(x)) : [];
  const status = oneOf(rec?.status, "status", ["reconciled", "draft"] as const);
  tx(() => {
    ensureBusiness(businessId);
    checkRefs(businessId, accountId, null);
    q("UPDATE transactions SET reconciled = 0, reconciliation_id = NULL WHERE reconciliation_id = ?").run(recId);
    q(
      `INSERT INTO reconciliations (id, business_id, account_id, statement_date, status, data) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET business_id=excluded.business_id, account_id=excluded.account_id,
         statement_date=excluded.statement_date, status=excluded.status, data=excluded.data`
    ).run(recId, businessId, accountId, date(rec?.statementDate, "statementDate"), status, JSON.stringify({ ...rec, id: recId }));
    const mark = q("UPDATE transactions SET reconciled = 1, reconciliation_id = ? WHERE id = ? AND business_id = ?");
    for (const t of ids) mark.run(recId, t, businessId);
  });
  res.json({ ok: true });
}));

dataRouter.delete("/reconciliations/:id", ah(async (req, res) => {
  tx(() => {
    q("UPDATE transactions SET reconciled = 0, reconciliation_id = NULL WHERE reconciliation_id = ?").run(req.params.id);
    q("DELETE FROM reconciliations WHERE id = ?").run(req.params.id);
  });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Backup / restore / legacy import
// ---------------------------------------------------------------------------
dataRouter.get("/backup", ah(async (_req, res) => {
  const state = loadBusinessState();
  res.setHeader("Content-Disposition", `attachment; filename="liteledger-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({
    liteledger: 1,
    exportedAt: new Date().toISOString(),
    businesses: state.businesses, accounts: state.accounts, categories: state.categories,
    transactions: state.transactions, reconciliations: state.reconciliations,
  });
}));

function insertSnapshot(s: any, remapCategories: boolean) {
  const bizIds = new Set<string>();
  for (const b of s.businesses || []) {
    const f = parseBusiness(b, false);
    const bid = idv(b.id, "business id");
    q(
      `INSERT INTO businesses (id, name, legal_name, structure, ein, industry, fiscal_year_end, currency, color, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(bid, f.name, f.legal_name, f.structure, f.ein, f.industry, f.fiscal_year_end, f.currency, f.color, typeof b.createdDate === "string" ? b.createdDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    bizIds.add(bid);
  }
  const catMap = new Map<string, string>(); // `${businessId}|${oldId}` -> new id
  const insCat = q(
    `INSERT INTO categories (id, business_id, name, type, schedule_c_line, description, is_tax_deductible, color, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let sort = 0;
  const cats: any[] = s.categories || [];
  for (const bid of bizIds) {
    for (const c of cats) {
      // New-format categories carry businessId; legacy ones were global and apply to every business.
      if (c.businessId && c.businessId !== bid) continue;
      const f = parseCategory(c, false);
      const cid = remapCategories ? newId("cat") : idv(c.id, "category id");
      insCat.run(cid, bid, f.name, f.type, f.schedule_c_line, f.description ?? null, f.is_tax_deductible, f.color ?? null, sort++);
      catMap.set(`${bid}|${c.id}`, cid);
    }
  }
  for (const a of s.accounts || []) {
    if (!bizIds.has(a.businessId)) continue;
    insertAccount(a.businessId, a);
    // insertAccount recomputes nothing: balances are restored verbatim from the snapshot.
  }
  for (const t of s.transactions || []) {
    if (!bizIds.has(t.businessId)) continue;
    const f = {
      businessId: t.businessId, accountId: t.accountId, date: t.date, payee: t.payee, description: t.description,
      amount: t.amount, id: t.id, source: t.source ?? "manual", notes: t.notes, aiConfidence: t.aiConfidence, aiReasoning: t.aiReasoning,
      categoryId: t.categoryId ? catMap.get(`${t.businessId}|${t.categoryId}`) ?? null : null,
    };
    // Insert without touching balances (they were restored with the accounts).
    const cat = f.categoryId;
    checkRefs(f.businessId, idv(f.accountId), cat);
    q(
      `INSERT INTO transactions (id, business_id, account_id, date, payee, description, amount, category_id, reconciled, reconciliation_id, source, notes, ai_confidence, ai_reasoning)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      freshId("transactions", "tx", f.id), f.businessId, f.accountId, date(f.date, "Date"), str(f.payee, "Payee", 200, { optional: true }),
      str(f.description, "Description", 500, { optional: true }), toCents(num(f.amount, "Amount")), cat,
      t.reconciled ? 1 : 0, t.reconciliationId ?? null, oneOf(f.source, "source", SOURCES), f.notes ? String(f.notes).slice(0, 2000) : null,
      typeof f.aiConfidence === "number" ? f.aiConfidence : null, f.aiReasoning ? String(f.aiReasoning).slice(0, 1000) : null
    );
  }
  for (const r of s.reconciliations || []) {
    if (!bizIds.has(r.businessId)) continue;
    q("INSERT INTO reconciliations (id, business_id, account_id, statement_date, status, data) VALUES (?, ?, ?, ?, ?, ?)").run(
      idv(r.id), r.businessId, r.accountId, date(r.statementDate, "statementDate"), r.status === "draft" ? "draft" : "reconciled", JSON.stringify(r)
    );
  }
}

// Replace everything with a LiteLedger backup file (admin only).
dataRouter.post("/backup/restore", requireAdmin, ah(async (req, res) => {
  if (req.body?.liteledger !== 1) throw new HttpError(400, "This does not look like a LiteLedger backup file");
  tx(() => {
    q("DELETE FROM businesses").run(); // cascades everything business-scoped
    insertSnapshot(req.body, false);
  });
  res.json(loadBusinessState());
}));

// Add data exported from the old browser-only version (localStorage). Existing ids are skipped.
dataRouter.post("/import/legacy", ah(async (req, res) => {
  const s = req.body || {};
  const existing = new Set((q("SELECT id FROM businesses").all() as Row[]).map((r) => r.id));
  const businesses = (s.businesses || []).filter((b: any) => !existing.has(b.id));
  if (!businesses.length) throw new HttpError(400, "Nothing to import (no new businesses found)");
  const keep = new Set(businesses.map((b: any) => b.id));
  tx(() => insertSnapshot({
    businesses,
    categories: s.categories || [],
    accounts: (s.accounts || []).filter((a: any) => keep.has(a.businessId)),
    transactions: (s.transactions || []).filter((t: any) => keep.has(t.businessId)),
    reconciliations: (s.reconciliations || []).filter((r: any) => keep.has(r.businessId)),
  }, true));
  res.json(loadBusinessState());
}));
