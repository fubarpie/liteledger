import { Router } from "express";
import net from "node:net";
import { db, tx, toCents } from "./db.ts";
import { requireAuth } from "./auth.ts";
import { HttpError, ah, id as idv } from "./util.ts";
import { encryptSecret, decryptSecret, newId } from "./security.ts";
import { loadBusinessState } from "./data.ts";

export const simplefinRouter = Router();
simplefinRouter.use(requireAuth);

const UA = "LiteLedger/1.0";
const q = (sql: string) => db.prepare(sql);

/** Reject non-https and obviously-internal hosts so the claim endpoint can't be aimed at the LAN. */
function assertPublicHttps(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, "Decoded token is not a valid URL. Check your SimpleFIN setup token.");
  }
  const host = u.hostname.toLowerCase();
  const privateV4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/;
  if (u.protocol !== "https:") throw new HttpError(400, "SimpleFIN URLs must use https");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || (net.isIP(host) && (privateV4.test(host) || host === "::1" || host.startsWith("fc") || host.startsWith("fd")))) {
    if (process.env.SIMPLEFIN_ALLOW_PRIVATE !== "true") throw new HttpError(400, "SimpleFIN URL points at a private address");
  }
  return u;
}

function ensureBusiness(businessId: string) {
  if (!q("SELECT 1 FROM businesses WHERE id = ?").get(businessId)) throw new HttpError(404, "Business not found");
}

simplefinRouter.post("/:businessId/claim", ah(async (req, res) => {
  const businessId = idv(req.params.businessId);
  ensureBusiness(businessId);
  const token = typeof req.body?.setupToken === "string" ? req.body.setupToken.trim() : "";
  if (!token) throw new HttpError(400, "Setup token is required");

  let claimUrl: string;
  if (/^https?:\/\//i.test(token) && /\/claim\//.test(token)) claimUrl = token;
  else claimUrl = Buffer.from(token, "base64").toString("utf8").trim();
  assertPublicHttps(claimUrl);

  const r = await fetch(claimUrl, { method: "POST", headers: { "Content-Length": "0", "User-Agent": UA } });
  if (!r.ok) {
    const body = (await r.text().catch(() => "")).slice(0, 200);
    throw new HttpError(r.status === 403 ? 400 : 502, `SimpleFIN claim failed (${r.status}). The token may already have been used or expired. ${body}`.trim());
  }
  const accessUrl = (await r.text()).trim();
  assertPublicHttps(accessUrl);
  q(
    `INSERT INTO bridge_configs (business_id, access_url_enc, status) VALUES (?, ?, 'connected')
     ON CONFLICT(business_id) DO UPDATE SET access_url_enc = excluded.access_url_enc, status = 'connected', error_message = NULL`
  ).run(businessId, encryptSecret(accessUrl));
  res.json({ bridgeConfig: loadBusinessState(businessId).bridgeConfigs[businessId] });
}));

// Connect with an Access URL you already have (skips the one-time setup token claim).
simplefinRouter.post("/:businessId/connect", ah(async (req, res) => {
  const businessId = idv(req.params.businessId);
  ensureBusiness(businessId);
  const accessUrl = typeof req.body?.accessUrl === "string" ? req.body.accessUrl.trim() : "";
  assertPublicHttps(accessUrl);
  q(
    `INSERT INTO bridge_configs (business_id, access_url_enc, status) VALUES (?, ?, 'connected')
     ON CONFLICT(business_id) DO UPDATE SET access_url_enc = excluded.access_url_enc, status = 'connected', error_message = NULL`
  ).run(businessId, encryptSecret(accessUrl));
  res.json({ bridgeConfig: loadBusinessState(businessId).bridgeConfigs[businessId] });
}));

simplefinRouter.delete("/:businessId", ah(async (req, res) => {
  q("DELETE FROM bridge_configs WHERE business_id = ?").run(idv(req.params.businessId));
  res.json({ ok: true });
}));

const guessType = (name: string) => {
  const n = name.toLowerCase();
  if (/credit|card|visa|mastercard|amex/.test(n)) return "credit_card";
  if (n.includes("savings")) return "savings";
  if (n.includes("mortgage")) return "mortgage";
  if (n.includes("loan")) return "loan";
  return "checking";
};
const dayOf = (epochSec: number) => new Date(epochSec * 1000).toISOString().slice(0, 10);

simplefinRouter.post("/:businessId/sync", ah(async (req, res) => {
  const businessId = idv(req.params.businessId);
  ensureBusiness(businessId);
  const cfg = q("SELECT * FROM bridge_configs WHERE business_id = ?").get(businessId) as any;
  if (!cfg) throw new HttpError(400, "SimpleFIN is not connected for this business");

  const access = new URL(decryptSecret(cfg.access_url_enc));
  const target = new URL(`${access.protocol}//${access.host}${access.pathname.replace(/\/$/, "")}/accounts`);
  if (cfg.last_synced_at) {
    const since = Math.floor(Date.parse(cfg.last_synced_at) / 1000) - 7 * 86400; // overlap to catch late-posting items
    target.searchParams.set("start-date", String(Math.max(0, since)));
  }
  const headers: Record<string, string> = { "User-Agent": UA, Accept: "application/json" };
  if (access.username) headers.Authorization = "Basic " + Buffer.from(`${decodeURIComponent(access.username)}:${decodeURIComponent(access.password)}`).toString("base64");

  const apiRes = await fetch(target, { headers });
  if (!apiRes.ok) {
    const msg = apiRes.status === 402 || apiRes.status === 403 ? "SimpleFIN rejected the credentials. Reconnect the bank feed." : `SimpleFIN returned HTTP ${apiRes.status}`;
    q("UPDATE bridge_configs SET status = 'error', error_message = ? WHERE business_id = ?").run(msg, businessId);
    throw new HttpError(502, msg);
  }
  const data: any = await apiRes.json();
  const sfAccounts: any[] = Array.isArray(data.accounts) ? data.accounts : [];

  let added = 0;
  tx(() => {
    for (const sa of sfAccounts) {
      const sid = String(sa.id);
      let acc = q("SELECT * FROM accounts WHERE business_id = ? AND simplefin_account_id = ?").get(businessId, sid) as any;
      const bal = toCents(parseFloat(sa.balance ?? "0") || 0);
      const avail = sa["available-balance"] !== undefined ? toCents(parseFloat(sa["available-balance"]) || 0) : bal;
      const now = new Date().toISOString();
      if (acc) {
        q("UPDATE accounts SET current_balance = ?, available_balance = ?, last_synced_at = ? WHERE id = ?").run(bal, avail, now, acc.id);
      } else {
        const accId = newId("act");
        q(
          `INSERT INTO accounts (id, business_id, name, type, institution, last4, current_balance, available_balance, simplefin_account_id, last_synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(accId, businessId, String(sa.name || "Synced Account").slice(0, 120), guessType(String(sa.name || "")), String(sa.org?.name || sa.org?.domain || "Bank").slice(0, 120), sid.slice(-4), bal, avail, sid, now);
        acc = { id: accId };
      }
      const sigs = new Set(
        (q("SELECT date, amount, description FROM transactions WHERE account_id = ? AND external_id IS NULL").all(acc.id) as any[]).map((t) => `${t.date}|${t.amount}|${t.description}`)
      );
      const ins = q(
        `INSERT OR IGNORE INTO transactions (id, business_id, account_id, date, payee, description, amount, category_id, reconciled, source, external_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, 'simplefin', ?, ?)`
      );
      for (const st of Array.isArray(sa.transactions) ? sa.transactions : []) {
        if (st.pending) continue; // only import posted items
        const d = st.posted ? dayOf(Number(st.posted)) : new Date().toISOString().slice(0, 10);
        const amount = toCents(parseFloat(st.amount ?? "0") || 0);
        const desc = String(st.description || st.memo || "Bank Transaction").slice(0, 500);
        if (sigs.has(`${d}|${amount}|${desc}`)) continue;
        const r = ins.run(newId("tx"), businessId, acc.id, d, String(st.payee || desc).slice(0, 200), desc, amount, String(st.id ?? `${d}|${amount}|${desc}`).slice(0, 200), st.memo ? String(st.memo).slice(0, 2000) : null);
        added += Number(r.changes);
      }
    }
    q("UPDATE bridge_configs SET last_synced_at = ?, status = 'connected', error_message = NULL WHERE business_id = ?").run(new Date().toISOString(), businessId);
  });

  const bankErrors: string[] = Array.isArray(data.errors) ? data.errors.map(String) : [];
  res.json({
    addedCount: added,
    message: `Synced ${sfAccounts.length} account${sfAccounts.length === 1 ? "" : "s"}. Imported ${added} new transaction${added === 1 ? "" : "s"}.` + (bankErrors.length ? ` Bank messages: ${bankErrors.join("; ")}` : ""),
    ...loadBusinessState(businessId),
  });
}));
