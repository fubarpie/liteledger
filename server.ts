import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || "3000", 10);

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// ==========================================
// SimpleFIN Bridge API Integration
// ==========================================

/**
 * Exchange a SimpleFIN setup token for an Access URL.
 * SimpleFIN setup tokens are base64 encoded claim URLs.
 */
app.post("/api/simplefin/claim", async (req, res) => {
  try {
    const { setupToken } = req.body;
    if (!setupToken || typeof setupToken !== "string") {
      return res.status(400).json({ error: "Setup token is required" });
    }

    const trimmed = setupToken.trim();

    // Support simulated demo token
    if (trimmed.toLowerCase() === "demo" || trimmed.startsWith("demo_")) {
      return res.json({
        accessUrl: "https://demo_user:demo_pass@bridge.simplefin.org/simplefin",
        isDemo: true,
        message: "Connected to SimpleFIN Demo Sandbox",
      });
    }

    // Decode base64 claim URL
    let claimUrl: string;
    try {
      claimUrl = Buffer.from(trimmed, "base64").toString("utf-8").trim();
    } catch {
      return res.status(400).json({ error: "Invalid base64 encoding for SimpleFIN setup token" });
    }

    if (!claimUrl.startsWith("http://") && !claimUrl.startsWith("https://")) {
      return res.status(400).json({
        error: "Decoded token is not a valid URL. Please check your SimpleFIN setup token.",
      });
    }

    // Call SimpleFIN claim URL (POST)
    const claimResponse = await fetch(claimUrl, {
      method: "POST",
      headers: {
        "Content-Length": "0",
        "User-Agent": "KiteBooks/1.0",
      },
    });

    if (!claimResponse.ok) {
      const errText = await claimResponse.text().catch(() => "");
      return res.status(claimResponse.status).json({
        error: `SimpleFIN Bridge claim failed: ${claimResponse.statusText}. ${errText}`,
      });
    }

    const accessUrl = (await claimResponse.text()).trim();
    return res.json({ accessUrl, isDemo: false });
  } catch (err: any) {
    console.error("SimpleFIN Claim Error:", err);
    return res.status(500).json({ error: err.message || "Failed to claim SimpleFIN token" });
  }
});

/**
 * Fetch accounts and transactions from SimpleFIN Access URL
 */
app.post("/api/simplefin/sync", async (req, res) => {
  try {
    const { accessUrl, startDate, endDate, isDemo } = req.body;

    if (!accessUrl) {
      return res.status(400).json({ error: "SimpleFIN Access URL is required" });
    }

    // If demo connection or demo URL
    if (isDemo || accessUrl.includes("demo_user") || accessUrl.includes("demo")) {
      const mockAccounts = generateMockSimpleFinData();
      return res.json({
        accounts: mockAccounts,
        isDemo: true,
        syncedAt: new Date().toISOString(),
      });
    }

    // Parse URL with credentials: https://username:password@bridge.simplefin.org/simplefin
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(accessUrl);
    } catch {
      return res.status(400).json({ error: "Invalid SimpleFIN Access URL format" });
    }

    const username = parsedUrl.username;
    const password = parsedUrl.password;

    // Clean URL without inline basic auth for fetch request
    const cleanUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname.replace(/\/$/, "")}/accounts`;
    const params = new URLSearchParams();
    if (startDate) params.set("start-date", String(startDate));
    if (endDate) params.set("end-date", String(endDate));

    const targetUrl = `${cleanUrl}?${params.toString()}`;

    const headers: Record<string, string> = {
      "User-Agent": "KiteBooks/1.0",
      Accept: "application/json",
    };

    if (username && password) {
      const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");
      headers["Authorization"] = `Basic ${basicAuth}`;
    }

    const apiRes = await fetch(targetUrl, { headers });

    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => "");
      return res.status(apiRes.status).json({
        error: `SimpleFIN Bridge sync error (${apiRes.status}): ${apiRes.statusText}. ${errBody}`,
      });
    }

    const data = await apiRes.json();
    return res.json({
      accounts: data.accounts || [],
      errors: data.errors || [],
      syncedAt: new Date().toISOString(),
      isDemo: false,
    });
  } catch (err: any) {
    console.error("SimpleFIN Sync Error:", err);
    return res.status(500).json({ error: err.message || "Failed to sync with SimpleFIN" });
  }
});

// Helper for Mock SimpleFIN Sandbox data
function generateMockSimpleFinData() {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  return [
    {
      id: "sfin_act_chk_01",
      name: "Commercial Operating Checking",
      currency: "USD",
      balance: "18450.75",
      "available-balance": "18450.75",
      "balance-date": now,
      org: {
        name: "First National Bank",
        domain: "firstnationalbank.com",
      },
      transactions: [
        {
          id: "sfin_tx_01",
          posted: now - day * 1,
          amount: "3200.00",
          description: "INCOMING WIRE CLIENT RETAINER - KINETIC LABS",
          payee: "Kinetic Labs LLC",
          memo: "Invoice #1042 Payment",
        },
        {
          id: "sfin_tx_02",
          posted: now - day * 2,
          amount: "-432.80",
          description: "HOME DEPOT #4819 MATERIALS & FASTENERS",
          payee: "The Home Depot",
          memo: "Job supplies",
        },
        {
          id: "sfin_tx_03",
          posted: now - day * 3,
          amount: "-850.00",
          description: "CHECK #1084 - DANIEL WOODS SUBCONTRACT FINISH",
          payee: "Daniel Woods",
          memo: "Subcontractor labor",
        },
        {
          id: "sfin_tx_04",
          posted: now - day * 4,
          amount: "1850.00",
          description: "STRIPE PAYOUT ACC-9921",
          payee: "Stripe",
          memo: "Online customer sales",
        },
        {
          id: "sfin_tx_05",
          posted: now - day * 5,
          amount: "-185.00",
          description: "PACIFIC GAS & ELECTRIC COMM BILL",
          payee: "PG&E",
          memo: "Shop electricity",
        },
      ],
    },
    {
      id: "sfin_act_cc_02",
      name: "Business Platinum Credit Card",
      currency: "USD",
      balance: "-1640.22",
      "available-balance": "23359.78",
      "balance-date": now,
      org: {
        name: "Chase Bank",
        domain: "chase.com",
      },
      transactions: [
        {
          id: "sfin_tx_cc_01",
          posted: now - day * 1,
          amount: "-65.40",
          description: "SHELL OIL 57321 FUEL FOR WORK TRUCK",
          payee: "Shell Oil",
          memo: "Vehicle Gas",
        },
        {
          id: "sfin_tx_cc_02",
          posted: now - day * 3,
          amount: "-78.50",
          description: "ADOBE CREATIVE CLOUD MONTHLY SUB",
          payee: "Adobe Systems",
          memo: "Design software",
        },
        {
          id: "sfin_tx_cc_03",
          posted: now - day * 4,
          amount: "-114.25",
          description: "LUNCH MEETING BISTRO CLIENT DISCUSS",
          payee: "Artisan Bistro",
          memo: "Client lunch",
        },
      ],
    },
    {
      id: "sfin_act_mort_03",
      name: "Commercial Building Mortgage / Loan",
      currency: "USD",
      balance: "-248600.00",
      "available-balance": "0.00",
      "balance-date": now,
      org: {
        name: "Wells Fargo Commercial Lending",
        domain: "wellsfargo.com",
      },
      transactions: [
        {
          id: "sfin_tx_mort_01",
          posted: now - day * 10,
          amount: "-1720.00",
          description: "MONTHLY PRINCIPAL & INTEREST PAYMENT",
          payee: "Wells Fargo Commercial",
          memo: "Commercial mortgage payment",
        },
      ],
    },
  ];
}

// ==========================================
// AI Auto-Categorization (Gemini 3.8 Flash)
// ==========================================

app.post("/api/ai/categorize", async (req, res) => {
  try {
    const { transactions, categories, businessType } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: "No transactions provided for categorization" });
    }

    const categoriesList = Array.isArray(categories) && categories.length > 0
      ? categories
      : [
          { id: "inc_sales", name: "Sales & Client Revenue", type: "income", scheduleC: "Line 1: Gross receipts" },
          { id: "inc_other", name: "Other Business Income", type: "income", scheduleC: "Line 6: Other income" },
          { id: "cogs_materials", name: "Cost of Goods - Materials & Supplies", type: "cogs", scheduleC: "Line 4: Cost of goods sold" },
          { id: "cogs_subcontractor", name: "Cost of Goods - Subcontract Labor", type: "cogs", scheduleC: "Line 4: Cost of goods sold" },
          { id: "exp_advertising", name: "Advertising & Marketing", type: "expense", scheduleC: "Line 8: Advertising" },
          { id: "exp_bank_fees", name: "Bank & Merchant Processing Fees", type: "expense", scheduleC: "Line 10/27: Bank charges" },
          { id: "exp_contract_labor", name: "Contract Labor (1099)", type: "expense", scheduleC: "Line 11: Contract labor" },
          { id: "exp_insurance", name: "Business Insurance", type: "expense", scheduleC: "Line 15: Insurance" },
          { id: "exp_interest", name: "Mortgage / Loan Interest", type: "expense", scheduleC: "Line 16b: Other interest" },
          { id: "exp_legal", name: "Legal & Professional Services", type: "expense", scheduleC: "Line 17: Legal and professional" },
          { id: "exp_office", name: "Office Expense & Software", type: "expense", scheduleC: "Line 18: Office expense" },
          { id: "exp_rent", name: "Rent & Facilities Lease", type: "expense", scheduleC: "Line 20b: Rent on other business property" },
          { id: "exp_repairs", name: "Repairs & Maintenance", type: "expense", scheduleC: "Line 21: Repairs and maintenance" },
          { id: "exp_supplies", name: "Shop & Job Supplies", type: "expense", scheduleC: "Line 22: Supplies" },
          { id: "exp_taxes", name: "Taxes & Licenses", type: "expense", scheduleC: "Line 23: Taxes and licenses" },
          { id: "exp_travel", name: "Travel & Lodging", type: "expense", scheduleC: "Line 24a: Travel" },
          { id: "exp_meals", name: "Business Meals (50% Deductible)", type: "expense", scheduleC: "Line 24b: Deductible meals" },
          { id: "exp_utilities", name: "Utilities (Power, Water, Internet)", type: "expense", scheduleC: "Line 25: Utilities" },
          { id: "exp_vehicle", name: "Vehicle Fuel & Mileage", type: "expense", scheduleC: "Line 9: Car and truck expenses" },
          { id: "transfer", name: "Transfer / Credit Card Payment", type: "transfer", scheduleC: "N/A: Non-deductible transfer" },
          { id: "equity_draw", name: "Owner Draw / Distribution", type: "equity", scheduleC: "N/A: Balance Sheet" },
          { id: "equity_contrib", name: "Owner Contribution / Capital", type: "equity", scheduleC: "N/A: Balance Sheet" },
        ];

    const simplifiedTx = transactions.map((t: any) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      payee: t.payee || t.description,
      amount: t.amount,
      accountType: t.accountType || "checking",
    }));

    const prompt = `You are a certified CPA and expert small business bookkeeper.
Business context: ${businessType || "Small Business / Family Enterprises"}.

Here are the available Chart of Accounts categories:
${JSON.stringify(categoriesList, null, 2)}

Categorize each of the following bank and credit card transactions accurately.
Rules:
1. Positive amounts are deposits / inflows (e.g. client payments, sales, interest, refunds). Negative amounts are outflows / expenses / purchases.
2. Match accurately to the best fitting category ID from the list.
3. If an inflow is from Stripe, Square, wire from client, or retainer, categorize as Sales / Revenue.
4. If an outflow is a payment between accounts (e.g. paying credit card bill, loan principal), mark as Transfer or appropriate loan/equity.
5. Provide a confidence score between 0.0 and 1.0.
6. Provide a concise, clear 1-sentence reasoning and specify the Schedule C line where applicable.

Transactions to categorize:
${JSON.stringify(simplifiedTx, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "The transaction ID" },
              categoryId: { type: Type.STRING, description: "The matched category ID" },
              categoryName: { type: Type.STRING, description: "The readable category name" },
              confidence: { type: Type.NUMBER, description: "Confidence score between 0 and 1" },
              reasoning: { type: Type.STRING, description: "Short explanation for why this category was chosen" },
              scheduleCLine: { type: Type.STRING, description: "IRS Schedule C line name or N/A" },
            },
            required: ["id", "categoryId", "categoryName", "confidence", "reasoning"],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.json({ suggestions: parsed });
  } catch (err: any) {
    console.error("AI Categorization Error:", err);
    return res.status(500).json({ error: err.message || "AI Categorization failed" });
  }
});

// ==========================================
// Setup Vite in Dev or Static in Production
// ==========================================

async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`KiteBooks server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
