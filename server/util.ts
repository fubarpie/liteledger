import type { Request, Response, NextFunction, RequestHandler } from "express";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wrap an async handler so rejections reach the error middleware. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function str(v: unknown, field: string, max = 200, opts: { optional?: boolean; allowEmpty?: boolean } = {}): string {
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return "";
    if (opts.allowEmpty && v === "") return "";
    throw new HttpError(400, `${field} is required`);
  }
  if (typeof v !== "string") throw new HttpError(400, `${field} must be text`);
  const t = v.trim();
  if (!t && !opts.allowEmpty && !opts.optional) throw new HttpError(400, `${field} is required`);
  if (t.length > max) throw new HttpError(400, `${field} is too long (max ${max})`);
  return t;
}

export function num(v: unknown, field: string): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e12) throw new HttpError(400, `${field} must be a valid number`);
  return n;
}

export function date(v: unknown, field: string): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + "T00:00:00Z"))) {
    throw new HttpError(400, `${field} must be a date (YYYY-MM-DD)`);
  }
  return v;
}

export function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return v as T;
}

export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export function id(v: unknown, field = "id"): string {
  if (typeof v !== "string" || !ID_RE.test(v)) throw new HttpError(400, `${field} is invalid`);
  return v;
}
