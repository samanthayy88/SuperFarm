import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Name of the sign-in cookie. */
export const SESSION_COOKIE = "farm_session";
export const SESSION_DAYS = 30;

/** Everything the server needs; anything missing means the online database is not set up yet. */
export function serverConfig() {
  const password = process.env.APP_PASSWORD;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!password || !url || !key) return null;
  return { password, url: url.replace(/\/$/, ""), key };
}

/** The signing secret is derived from the password and database key, so changing the password signs every device out. */
function secret(cfg: NonNullable<ReturnType<typeof serverConfig>>): string {
  return createHash("sha256").update(`farm-session:${cfg.password}:${cfg.key}`).digest("hex");
}

const sign = (cfg: NonNullable<ReturnType<typeof serverConfig>>, expires: number) =>
  createHmac("sha256", secret(cfg)).update(String(expires)).digest("hex");

export function makeToken(cfg: NonNullable<ReturnType<typeof serverConfig>>): string {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return `${expires}.${sign(cfg, expires)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(cfg: NonNullable<ReturnType<typeof serverConfig>>, given: string): boolean {
  return safeEqual(given, cfg.password);
}

export function tokenValid(cfg: NonNullable<ReturnType<typeof serverConfig>>, token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  const expires = Number(exp);
  if (!sig || !Number.isFinite(expires) || expires < Date.now()) return false;
  return safeEqual(sig, sign(cfg, expires));
}

// ---- slow down password guessing: 8 wrong tries per 15 minutes per address (best effort per server instance) ----
const fails = new Map<string, { n: number; first: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 8;

export function tooManyTries(ip: string): boolean {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW) {
    fails.delete(ip);
    return false;
  }
  return f.n >= MAX_FAILS;
}
export function recordFail(ip: string) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.first > WINDOW) fails.set(ip, { n: 1, first: Date.now() });
  else f.n += 1;
}
export function clearFails(ip: string) {
  fails.delete(ip);
}
