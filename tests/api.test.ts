import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
let proc: ChildProcess;
let dir: string;
let cookie = "";

async function api(method: string, url: string, body?: unknown, opts: { cookie?: string | null; headers?: Record<string, string> } = {}) {
  const c = opts.cookie === undefined ? cookie : opts.cookie;
  const res = await fetch(BASE + url, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(c ? { Cookie: c } : {}), ...opts.headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  if (set && set.includes("ll_session=") && !set.includes("Max-Age=0")) cookie = set.split(";")[0];
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, json };
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-test-"));
  proc = spawn("npx", ["tsx", "server.ts"], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, NODE_ENV: "production" },
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + "/api/health")).ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server did not start");
});
after(() => { proc?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test("fresh install requires setup and has no data", async () => {
  const s = await api("GET", "/api/auth/status", undefined, { cookie: null });
  assert.equal(s.json.setupRequired, true);
  assert.equal((await api("GET", "/api/bootstrap", undefined, { cookie: null })).status, 401);
});

test("setup creates admin once; weak passwords rejected", async () => {
  assert.equal((await api("POST", "/api/auth/setup", { name: "Kee", email: "k@example.com", password: "short" })).status, 400);
  const ok = await api("POST", "/api/auth/setup", { name: "Kee", email: "k@example.com", password: "correct horse battery" });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.user.role, "admin");
  assert.equal((await api("POST", "/api/auth/setup", { name: "X", email: "x@example.com", password: "another long password" })).status, 409);
  const b = await api("GET", "/api/bootstrap");
  assert.deepEqual(b.json.businesses, []);
  assert.deepEqual(b.json.transactions, []);
});

test("login / logout / bad password", async () => {
  const saved = cookie;
  assert.equal((await api("POST", "/api/auth/login", { email: "k@example.com", password: "wrong wrong wrong" }, { cookie: null })).status, 401);
  assert.equal((await api("POST", "/api/auth/logout", {})).status, 200);
  assert.equal((await api("GET", "/api/bootstrap", undefined, { cookie: saved })).status, 401);
  const l = await api("POST", "/api/auth/login", { email: "K@Example.com", password: "correct horse battery" }, { cookie: null });
  assert.equal(l.status, 200);
});

test("cross-origin writes are blocked", async () => {
  const r = await api("POST", "/api/businesses", { name: "Evil" }, { headers: { Origin: "http://evil.example" } });
  assert.equal(r.status, 403);
});

let biz = "", acct = "", cat = "", t1 = "";

test("create business with default categories + account", async () => {
  const r = await api("POST", "/api/businesses", { name: "Acme", structure: "LLC", accounts: [{ name: "Checking", type: "checking", currentBalance: 1000 }] });
  assert.equal(r.status, 201);
  biz = r.json.businesses[0].id;
  assert.ok(r.json.categories.length > 10);
  assert.equal(r.json.accounts[0].currentBalance, 1000);
  acct = r.json.accounts[0].id;
  cat = r.json.categories.find((c: any) => c.type === "expense").id;
});

test("transactions: create, edit, balance tracking, delete", async () => {
  const c = await api("POST", "/api/transactions", { businessId: biz, accountId: acct, date: "2025-03-01", payee: "Staples", description: "Paper", amount: -50.25 });
  assert.equal(c.status, 201);
  t1 = c.json.transaction.id;
  let b = (await api("GET", "/api/bootstrap")).json;
  assert.equal(b.accounts[0].currentBalance, 949.75);

  const e = await api("PATCH", `/api/transactions/${t1}`, { amount: -75.5, payee: "Staples Inc", categoryId: cat, notes: "edited" });
  assert.equal(e.status, 200);
  assert.equal(e.json.transaction.amount, -75.5);
  assert.equal(e.json.transaction.categoryName.length > 0, true);
  b = (await api("GET", "/api/bootstrap")).json;
  assert.equal(b.accounts[0].currentBalance, 924.5);

  // category validation: foreign / bogus category rejected
  assert.equal((await api("PATCH", `/api/transactions/${t1}`, { categoryId: "nope" })).status, 400);
  assert.equal((await api("PATCH", `/api/transactions/${t1}`, { date: "03/01/2025" })).status, 400);

  const d = await api("DELETE", `/api/transactions/${t1}`);
  assert.equal(d.status, 200);
  b = (await api("GET", "/api/bootstrap")).json;
  assert.equal(b.accounts[0].currentBalance, 1000);
});

test("reconciled transactions are protected", async () => {
  const c = await api("POST", "/api/transactions", { businessId: biz, accountId: acct, date: "2025-03-02", payee: "Client", description: "Inv", amount: 200 });
  const id = c.json.transaction.id;
  const rec = await api("PUT", "/api/reconciliations/rec1", {
    id: "rec1", businessId: biz, accountId: acct, statementDate: "2025-03-31", status: "reconciled", clearedTransactionIds: [id],
  });
  assert.equal(rec.status, 200);
  assert.equal((await api("PATCH", `/api/transactions/${id}`, { amount: 300 })).status, 409);
  assert.equal((await api("DELETE", `/api/transactions/${id}`)).status, 409);
  // category / notes edits are still allowed
  assert.equal((await api("PATCH", `/api/transactions/${id}`, { categoryId: cat, notes: "ok" })).status, 200);
  assert.equal((await api("DELETE", "/api/reconciliations/rec1")).status, 200);
  assert.equal((await api("DELETE", `/api/transactions/${id}`)).status, 200);
});

test("deleting a category uncategorizes its transactions", async () => {
  const c = await api("POST", "/api/transactions", { businessId: biz, accountId: acct, date: "2025-03-03", payee: "X", amount: -5, categoryId: cat });
  assert.equal(c.json.transaction.categoryId, cat);
  await api("DELETE", `/api/categories/${cat}`);
  const b = (await api("GET", "/api/bootstrap")).json;
  assert.equal(b.transactions.find((t: any) => t.id === c.json.transaction.id).categoryId, null);
});

test("backup -> restore round-trips", async () => {
  const backup = (await api("GET", "/api/backup")).json;
  assert.equal(backup.liteledger, 1);
  const before = (await api("GET", "/api/bootstrap")).json;
  const r = await api("POST", "/api/backup/restore", backup);
  assert.equal(r.status, 200);
  const after = (await api("GET", "/api/bootstrap")).json;
  assert.equal(after.transactions.length, before.transactions.length);
  assert.equal(after.accounts[0].currentBalance, before.accounts[0].currentBalance);
  assert.equal(after.categories.length, before.categories.length);
});

test("user management & member restrictions", async () => {
  const adminCookie = cookie;
  const u = await api("POST", "/api/users", { name: "Bookkeeper", email: "bk@example.com", password: "a long enough password", role: "member" });
  assert.equal(u.status, 201);
  await api("POST", "/api/auth/login", { email: "bk@example.com", password: "a long enough password" }, { cookie: null });
  const memberCookie = cookie;
  assert.equal((await api("GET", "/api/users")).status, 403);
  assert.equal((await api("DELETE", `/api/businesses/${biz}`)).status, 403);
  assert.equal((await api("GET", "/api/bootstrap")).status, 200);
  cookie = adminCookie;
  assert.equal((await api("DELETE", `/api/users/${u.json.user.id}`)).status, 200);
  assert.equal((await api("GET", "/api/bootstrap", undefined, { cookie: memberCookie })).status, 401);
});

test("legacy browser data import maps global categories per business", async () => {
  const r = await api("POST", "/api/import/legacy", {
    businesses: [{ id: "biz_old", name: "Old Biz", structure: "LLC", createdDate: "2024-01-01" }],
    categories: [{ id: "inc_sales", name: "Sales", type: "income", scheduleCLine: "Line 1", isTaxDeductible: false }],
    accounts: [{ id: "act_old", businessId: "biz_old", name: "Chk", type: "checking", currentBalance: 10 }],
    transactions: [{ id: "tx_old", businessId: "biz_old", accountId: "act_old", date: "2024-02-02", payee: "P", description: "D", amount: 10, categoryId: "inc_sales", source: "manual" }],
    reconciliations: [],
  });
  assert.equal(r.status, 200);
  const t = r.json.transactions.find((x: any) => x.id === "tx_old");
  assert.equal(t.categoryName, "Sales");
  assert.equal(r.json.accounts.find((a: any) => a.id === "act_old").currentBalance, 10);
});
