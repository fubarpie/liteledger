import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

import { authRouter, usersRouter, loadUser, csrfGuard } from "./server/auth.ts";
import { dataRouter } from "./server/data.ts";
import { simplefinRouter } from "./server/simplefin.ts";
import { aiRouter, aiEnabled, aiModel } from "./server/ai.ts";
import { HttpError } from "./server/util.ts";
import { DATA_DIR } from "./server/db.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = parseInt(process.env.PORT || "3000", 10);
const isProd = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
// Set TRUST_PROXY=true when running behind a reverse proxy (nginx, Caddy, Traefik, Cloudflare Tunnel...)
// so client IPs and https detection (secure cookies) are correct.
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", true);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  if (isProd) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
  }
  next();
});

// Backups can be large; everything else is small.
app.use("/api/backup/restore", express.json({ limit: "100mb" }));
app.use("/api/import", express.json({ limit: "100mb" }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ai: aiEnabled(), model: aiModel() });
});

app.use("/api", loadUser, csrfGuard);
app.get("/api/config", (_req, res) => res.json({ ai: aiEnabled(), model: aiModel() }));
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/simplefin", simplefinRouter);
app.use("/api/ai", aiRouter);
app.use("/api", dataRouter);

app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found")));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON" });
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => res.sendFile(path.resolve(__dirname, "dist", "index.html")));
  }
  app.listen(port, "0.0.0.0", () => {
    console.log(`LiteLedger running on http://0.0.0.0:${port} (data: ${DATA_DIR})`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
