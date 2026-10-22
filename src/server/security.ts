import "server-only";

import { createHash, randomBytes, scrypt, timingSafeEqual, type BinaryLike } from "node:crypto";

/**
 * Credential and token primitives. Nothing here touches storage — it is the
 * small, auditable core that the session and user modules build on.
 */

const KEY_LENGTH = 64;
// scrypt cost: 2^15 iterations, 8 blocks. ~60ms on a modern core — slow enough to
// make offline guessing expensive, fast enough that logging in feels instant.
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function derive(password: BinaryLike, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** `scrypt$<salt>$<hash>` — salted per password, so equal passwords never share a hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password.normalize("NFKC"), salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await derive(password.normalize("NFKC"), Buffer.from(saltB64, "base64"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * A real hash of a throwaway password, checked when the username does not exist.
 * Without it "unknown user" returns measurably faster than "wrong password" and
 * the login form leaks which usernames are real.
 */
let decoy: Promise<string> | null = null;
export function decoyHash() {
  decoy ??= hashPassword(randomBytes(12).toString("hex"));
  return decoy;
}

/** 256 bits from the OS CSPRNG, URL-safe — the opaque value stored in the cookie. */
export const newSessionToken = () => randomBytes(32).toString("base64url");

/** Only the SHA-256 of a token is persisted, so a leaked data file cannot be replayed as sessions. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const randomId = (prefix: string) => `${prefix}-${randomBytes(5).toString("hex")}`;

const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Human-typeable random password for seeded accounts (no 0/O/1/l/I lookalikes). */
export function generatePassword(length = 14) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  // Guarantee every class so it also satisfies the password policy.
  return `${out.slice(0, -2)}${"23456789"[bytes[0] % 8]}${"ABCDEFGH"[bytes[1] % 8]}`;
}

/** Shared by user creation, password reset and password change. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 128) return "Use at most 128 characters.";
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  return null;
}

/* ---------------------------------------------------------------------------
   In-memory sliding-window counters, keyed by client address or username.
   They complement the per-account lockout stored with the user: that protects
   one victim account, these stop a single client spraying many usernames and
   cover usernames that do not exist (so the response never reveals which do).
--------------------------------------------------------------------------- */
const globalForLimiter = globalThis as unknown as { __otsLimiter?: Map<string, number[]> };
const hits = (globalForLimiter.__otsLimiter ??= new Map());

const recent = (key: string, windowMs: number): number[] => {
  const now = Date.now();
  return (hits.get(key) ?? []).filter((time: number) => now - time < windowMs);
};

/** True once `limit` hits have been recorded inside the window. Does not record anything itself. */
export const isLimited = (key: string, limit: number, windowMs: number) =>
  recent(key, windowMs).length >= limit;

export function recordHit(key: string, windowMs: number) {
  const times = recent(key, windowMs);
  times.push(Date.now());
  hits.set(key, times);
  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    const now = Date.now();
    for (const [entry, stamps] of hits) {
      if (stamps.every((time: number) => now - time >= windowMs)) hits.delete(entry);
    }
  }
}

export const clearHits = (key: string) => void hits.delete(key);
