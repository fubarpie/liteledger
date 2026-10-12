import { Router, type Request, type Response, type NextFunction } from "express";
import { db, tx } from "./db.ts";
import { hashPassword, verifyPassword, newToken, hashToken, newId } from "./security.ts";
import { HttpError, ah, str } from "./util.ts";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const COOKIE = "ll_session";
const SESSION_DAYS = 30;
const MIN_PASSWORD = 10;

const parseCookies = (header: string | undefined) => {
  const out: Record<string, string> = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
};

function setSessionCookie(req: Request, res: Response, token: string | null) {
  const secureEnv = (process.env.COOKIE_SECURE || "auto").toLowerCase();
  const secure = secureEnv === "true" || (secureEnv === "auto" && req.secure);
  const parts = [
    `${COOKIE}=${token ? encodeURIComponent(token) : ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    token ? `Max-Age=${SESSION_DAYS * 86400}` : "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function createSession(userId: string): string {
  const token = newToken();
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))"
  ).run(hashToken(token), userId, `+${SESSION_DAYS} days`);
  return token;
}

/** Populates req.user if a valid session cookie is present. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) {
    const row = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, s.token_hash, s.last_used_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
      )
      .get(hashToken(token)) as any;
    if (row) {
      req.user = { id: row.id, email: row.email, name: row.name, role: row.role };
      // sliding expiry, written at most once a day
      if (Date.now() - Date.parse(row.last_used_at + "Z") > 86400_000) {
        db.prepare("UPDATE sessions SET last_used_at = datetime('now'), expires_at = datetime('now', ?) WHERE token_hash = ?").run(
          `+${SESSION_DAYS} days`,
          row.token_hash
        );
      }
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Not signed in"));
  next();
}
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Not signed in"));
  if (req.user.role !== "admin") return next(new HttpError(403, "Administrator access required"));
  next();
}

/** CSRF defence in depth (cookie is SameSite=Lax): mutating requests must be JSON and same-origin. */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return next(new HttpError(403, "Cross-origin request blocked"));
    } catch {
      return next(new HttpError(403, "Bad Origin header"));
    }
  }
  const hasBody = Number(req.headers["content-length"] || 0) > 0;
  if (hasBody && !req.is("application/json")) return next(new HttpError(415, "Content-Type must be application/json"));
  next();
}

// --- login throttling (in-memory, per process) ---
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;
function throttleKey(req: Request, email: string) {
  return `${req.ip}|${email.toLowerCase()}`;
}
function checkThrottle(key: string) {
  const a = attempts.get(key);
  if (a && Date.now() - a.first < WINDOW_MS && a.count >= MAX_ATTEMPTS) {
    throw new HttpError(429, "Too many failed sign-in attempts. Try again in a few minutes.");
  }
}
function noteFailure(key: string) {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first >= WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else a.count++;
}

function validatePassword(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters`);
  }
  if (pw.length > 200) throw new HttpError(400, "Password too long");
  return pw;
}
function validateEmail(v: unknown): string {
  const e = str(v, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, "Enter a valid email address");
  return e;
}

export const userCount = () => (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;

export const authRouter = Router();

authRouter.get(
  "/status",
  ah(async (req, res) => {
    res.json({ setupRequired: userCount() === 0, user: req.user || null });
  })
);

// First-run only: creates the administrator.
authRouter.post(
  "/setup",
  ah(async (req, res) => {
    const name = str(req.body?.name, "name", 100);
    const email = validateEmail(req.body?.email);
    const hash = await hashPassword(validatePassword(req.body?.password));
    const id = newId("usr");
    tx(() => {
      if (userCount() > 0) throw new HttpError(409, "Setup already completed");
      db.prepare("INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'admin')").run(id, email, name, hash);
    });
    setSessionCookie(req, res, createSession(id));
    res.status(201).json({ user: { id, email, name, role: "admin" } });
  })
);

authRouter.post(
  "/login",
  ah(async (req, res) => {
    const email = validateEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const key = throttleKey(req, email);
    checkThrottle(key);
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    // Always run a hash comparison so timing doesn't reveal whether the account exists.
    const ok = await verifyPassword(password, row?.password_hash || "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
    if (!row || !ok) {
      noteFailure(key);
      throw new HttpError(401, "Incorrect email or password");
    }
    attempts.delete(key);
    setSessionCookie(req, res, createSession(row.id));
    res.json({ user: { id: row.id, email: row.email, name: row.name, role: row.role } });
  })
);

authRouter.post(
  "/logout",
  ah(async (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    setSessionCookie(req, res, null);
    res.json({ ok: true });
  })
);

authRouter.post(
  "/change-password",
  requireAuth,
  ah(async (req, res) => {
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user!.id) as any;
    if (!(await verifyPassword(String(req.body?.currentPassword || ""), row.password_hash))) {
      throw new HttpError(400, "Current password is incorrect");
    }
    const hash = await hashPassword(validatePassword(req.body?.newPassword));
    const current = hashToken(parseCookies(req.headers.cookie)[COOKIE] || "");
    tx(() => {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.user!.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(req.user!.id, current);
    });
    res.json({ ok: true });
  })
);

// --- user management (admin) ---
export const usersRouter = Router();
usersRouter.use(requireAdmin);

usersRouter.get(
  "/",
  ah(async (_req, res) => {
    res.json({ users: db.prepare("SELECT id, email, name, role, created_at AS createdAt FROM users ORDER BY created_at").all() });
  })
);

usersRouter.post(
  "/",
  ah(async (req, res) => {
    const name = str(req.body?.name, "name", 100);
    const email = validateEmail(req.body?.email);
    const role = req.body?.role === "admin" ? "admin" : "member";
    const hash = await hashPassword(validatePassword(req.body?.password));
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new HttpError(409, "A user with that email already exists");
    const id = newId("usr");
    db.prepare("INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)").run(id, email, name, hash, role);
    res.status(201).json({ user: { id, email, name, role } });
  })
);

usersRouter.post(
  "/:id/reset-password",
  ah(async (req, res) => {
    const hash = await hashPassword(validatePassword(req.body?.newPassword));
    const r = tx(() => {
      const info = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.params.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.params.id);
      return info;
    });
    if (!r.changes) throw new HttpError(404, "User not found");
    res.json({ ok: true });
  })
);

usersRouter.patch(
  "/:id",
  ah(async (req, res) => {
    const role = req.body?.role === "admin" ? "admin" : "member";
    tx(() => {
      const target = db.prepare("SELECT role FROM users WHERE id = ?").get(req.params.id) as any;
      if (!target) throw new HttpError(404, "User not found");
      if (target.role === "admin" && role !== "admin") {
        const admins = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as any).c;
        if (admins <= 1) throw new HttpError(400, "There must be at least one administrator");
      }
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
    });
    res.json({ ok: true });
  })
);

usersRouter.delete(
  "/:id",
  ah(async (req, res) => {
    if (req.params.id === req.user!.id) throw new HttpError(400, "You cannot delete your own account");
    const r = db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    if (!r.changes) throw new HttpError(404, "User not found");
    res.json({ ok: true });
  })
);
