import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { DATA_DIR } from "./db.ts";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;

// ---------------------------------------------------------------------------
// Master key (encrypts SimpleFIN access URLs at rest).
// Provide LITELEDGER_SECRET (any long random string) or one is generated once
// and stored in the data volume with 0600 permissions.
// ---------------------------------------------------------------------------
function loadMasterKey(): Buffer {
  const env = process.env.LITELEDGER_SECRET;
  if (env && env.length >= 16) return crypto.createHash("sha256").update(env).digest();
  const file = path.join(DATA_DIR, "secret.key");
  if (fs.existsSync(file)) return Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key.toString("hex"), { mode: 0o600 });
  return key;
}
const MASTER_KEY = loadMasterKey();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", MASTER_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(blob: string): string {
  const [v, iv, tag, enc] = blob.split(".");
  if (v !== "v1") throw new Error("Unknown secret format");
  const d = crypto.createDecipheriv("aes-256-gcm", MASTER_KEY, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Passwords (scrypt) and tokens
// ---------------------------------------------------------------------------
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return crypto.timingSafeEqual(actual, expected);
}

export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
