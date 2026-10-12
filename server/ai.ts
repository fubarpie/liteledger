import { Router } from "express";
import { requireAuth } from "./auth.ts";
import { HttpError, ah } from "./util.ts";

// AI provider: OpenRouter (or any OpenAI-compatible endpoint, e.g. Ollama / LM Studio).
const BASE_URL = () => (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const MODEL = () => process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
const REQUIRE_KEY = () => process.env.AI_REQUIRE_KEY !== "false";
export const aiEnabled = () => !REQUIRE_KEY() || Boolean(process.env.OPENROUTER_API_KEY);
export const aiModel = MODEL;

export const aiRouter = Router();
aiRouter.use(requireAuth);

const BATCH = 40;

async function categorizeBatch(txs: any[], categories: any[], businessType: string) {
  const simplified = txs.map((t) => ({
    id: t.id, date: t.date, description: t.description, payee: t.payee || t.description, amount: t.amount,
  }));
  const instruction = `You are a certified CPA and expert small business bookkeeper.
Business context: ${businessType || "Small business"}.

Available categories (Chart of Accounts):
${JSON.stringify(categories)}

Categorize each bank / credit card transaction below.
Rules:
1. Positive amounts are deposits/inflows (sales, interest, refunds). Negative amounts are outflows/expenses.
2. Choose the best-fitting category id from the list ONLY. Never invent ids.
3. Payments between the business's own accounts (credit card payments, loan principal, account transfers) are transfers.
4. Provide a confidence between 0.0 and 1.0 and a one-sentence reasoning.

Transactions:
${JSON.stringify(simplified)}

Respond with ONLY a JSON array (no markdown, no prose). Each element:
{"id": string, "categoryId": string, "confidence": number, "reasoning": string}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL || "https://github.com/fubarpie/liteledger",
    "X-Title": "LiteLedger",
  };
  if (process.env.OPENROUTER_API_KEY) headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;

  const r = await fetch(`${BASE_URL()}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: MODEL(), temperature: 0.1, messages: [{ role: "user", content: instruction }] }),
  });
  const body: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, body?.error?.message || `AI provider returned HTTP ${r.status}`);

  const text: string = body?.choices?.[0]?.message?.content || "[]";
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (!m) throw new HttpError(502, "The AI model did not return valid JSON. Try a different OPENROUTER_MODEL.");
    try { parsed = JSON.parse(m[0]); } catch { throw new HttpError(502, "The AI model did not return valid JSON. Try a different OPENROUTER_MODEL."); }
  }
  if (!Array.isArray(parsed)) parsed = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  return parsed as any[];
}

aiRouter.post("/categorize", ah(async (req, res) => {
  if (!aiEnabled()) throw new HttpError(503, "AI categorization is disabled: OPENROUTER_API_KEY is not set on the server.");
  const { transactions, categories, businessType } = req.body || {};
  if (!Array.isArray(transactions) || !transactions.length) throw new HttpError(400, "No transactions provided");
  if (!Array.isArray(categories) || !categories.length) throw new HttpError(400, "This business has no categories yet. Add some first.");
  if (transactions.length > 500) throw new HttpError(400, "Categorize at most 500 transactions at a time");

  const cats = categories.map((c: any) => ({ id: c.id, name: c.name, type: c.type, taxLine: c.scheduleC }));
  const byId = new Map<string, any>(categories.map((c: any) => [c.id, c]));
  const suggestions: any[] = [];
  for (let i = 0; i < transactions.length; i += BATCH) {
    const out = await categorizeBatch(transactions.slice(i, i + BATCH), cats, String(businessType || ""));
    for (const s of out) {
      const cat = byId.get(s?.categoryId);
      if (!s?.id || !cat) continue; // drop hallucinated ids
      suggestions.push({
        id: String(s.id), categoryId: cat.id, categoryName: cat.name,
        confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0)),
        reasoning: String(s.reasoning || "").slice(0, 500), scheduleCLine: cat.scheduleC,
      });
    }
  }
  res.json({ suggestions });
}));
