import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORIES, MENU_ITEMS, SEED_DEALS } from "@/data/menu";
import { buildSeedOrders, SEED_ORDER_COUNTER } from "@/data/orders";
import { DEFAULT_PRICING } from "@/data/settings";
import type {
  AuditEntry,
  Deal,
  MenuItem,
  Order,
  Pricing,
  Role,
} from "@/lib/types";
import { generatePassword, hashPassword, randomId } from "./security";

/**
 * File-backed data store.
 *
 * Everything the app persists lives in one JSON document under `.data/` (git
 * ignored). Reads come from an in-memory copy; every write runs through
 * `mutate()`, which serialises writers, applies the change to a *clone*, writes
 * it to disk atomically (temp file + rename) and only then publishes it — so a
 * failed or half-applied change can never corrupt what other requests see.
 *
 * This is deliberately a single-process store: perfect for one register or a
 * small deployment. Moving to Postgres/MySQL later means re-implementing
 * `getDb`/`mutate` and the functions in `data.ts`; no page or action changes.
 */

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  role: Role;
  passwordHash: string;
  frozen: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface SessionRecord {
  /** SHA-256 of the cookie token — the token itself is never stored. */
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface Database {
  version: 1;
  users: UserRecord[];
  sessions: SessionRecord[];
  menuItems: MenuItem[];
  deals: Deal[];
  orders: Order[];
  audit: AuditEntry[];
  settings: { pricing: Pricing; orderCounter: number };
}

interface Holder {
  db: Database | null;
  loading: Promise<Database> | null;
  queue: Promise<unknown>;
}

// Dev servers load a module once per bundle; hanging state off `globalThis`
// keeps one store and one write queue no matter how often that happens.
const globalForDb = globalThis as unknown as { __otsDb?: Holder };
const holder: Holder = (globalForDb.__otsDb ??= { db: null, loading: null, queue: Promise.resolve() });

export const DATA_DIR = process.env.OTS_DATA_DIR ?? path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

async function seed(): Promise<Database> {
  const now = new Date();
  const iso = now.toISOString();
  const pricing = DEFAULT_PRICING;

  // No account ships with a known password: each is random, shown once.
  const accounts: { name: string; username: string; role: Role; password: string }[] = [
    { name: "Hassan K.", username: "superadmin", role: "super_admin", password: generatePassword() },
    { name: "Sara Ahmed", username: "cashier", role: "admin", password: generatePassword() },
    { name: "Bilal Raza", username: "waiter", role: "worker", password: generatePassword() },
  ];

  const users: UserRecord[] = [];
  for (const account of accounts) {
    users.push({
      id: randomId("usr"),
      name: account.name,
      username: account.username,
      role: account.role,
      passwordHash: await hashPassword(account.password),
      frozen: false,
      createdAt: iso,
      lastLoginAt: null,
      failedAttempts: 0,
      lockedUntil: null,
    });
  }

  const creators = users.filter((user) => user.role !== "super_admin").map(({ id, name }) => ({ id, name }));
  const orders = buildSeedOrders(now, creators, pricing);

  const db: Database = {
    version: 1,
    users,
    sessions: [],
    menuItems: structuredClone(MENU_ITEMS),
    deals: SEED_DEALS.map((deal) => ({
      ...deal,
      image: null,
      ingredients: null,
      optionGroups: [],
      active: true,
      createdAt: iso,
      createdBy: users[0].id,
    })),
    orders,
    audit: [],
    settings: { pricing: structuredClone(pricing), orderCounter: SEED_ORDER_COUNTER(orders) },
  };

  await persist(db);

  const lines = accounts.map(
    (account) => `${account.role.padEnd(12)} ${account.username.padEnd(12)} ${account.password}`,
  );
  const credentials = [
    "Initial sign-in details — generated on first start.",
    "Sign in, then change these from the account menu. Delete this file afterwards.",
    "",
    "role         username     password",
    ...lines,
    "",
  ].join("\n");
  await writeFile(path.join(DATA_DIR, "initial-credentials.txt"), credentials, { mode: 0o600 });
  console.log(
    `\n[ots] First start — created the data store in ${DATA_DIR}\n[ots] Initial sign-in details were written to ${path.join(DATA_DIR, "initial-credentials.txt")}\n${credentials}`,
  );

  return db;
}

async function persist(db: Database) {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = `${DB_FILE}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(db), { mode: 0o600 });
  await rename(temp, DB_FILE);
}

/** Menu items, deals and cart lines used to carry an emoji `icon`; replaced by a photo `image`. */
function addImageField(entry: Record<string, unknown>) {
  if (typeof entry.image === "undefined") entry.image = null;
  delete entry.icon;
}

/** Option groups saved before `maxSelect` existed get the old, unlimited behaviour. */
function addMaxSelectField(groups: unknown) {
  if (!Array.isArray(groups)) return;
  for (const group of groups as Record<string, unknown>[]) {
    if (typeof group.maxSelect === "undefined") group.maxSelect = null;
  }
}

/**
 * Brings a store written by an older version up to date — applied in memory on every load, same as
 * every read since first start; the file on disk only catches up on the next write.
 *
 * - The "served" status no longer exists. Orders saved with it move on: paid ones are
 *   complete, unpaid ones are ready (still waiting on the bill).
 * - Menu items, deals and cart lines get an `image` field in place of their old `icon`.
 */
function migrate(db: Database): Database {
  for (const order of db.orders) {
    if ((order.status as string) === "served") order.status = order.payment ? "completed" : "ready";
    for (const line of order.lines) addImageField(line as unknown as Record<string, unknown>);
    // An order from before dine-in tracking existed (or one a dev build briefly stripped it from)
    // has neither field — treat it as a non-table order rather than crash rendering it.
    const loose = order as Partial<Record<"tableId" | "guests", unknown>>;
    if (typeof loose.tableId === "undefined") order.tableId = null;
    if (typeof loose.guests === "undefined") order.guests = 1;
  }
  for (const item of db.menuItems) {
    addImageField(item as unknown as Record<string, unknown>);
    addMaxSelectField(item.optionGroups);
  }
  for (const deal of db.deals) {
    addImageField(deal as unknown as Record<string, unknown>);
    const loose = deal as unknown as Partial<Record<"ingredients" | "optionGroups", unknown>>;
    if (typeof loose.ingredients === "undefined") deal.ingredients = null;
    if (!Array.isArray(loose.optionGroups)) deal.optionGroups = [];
    addMaxSelectField(deal.optionGroups);
  }
  if (typeof db.settings.orderCounter !== "number") {
    db.settings.orderCounter = SEED_ORDER_COUNTER(db.orders);
  }
  // Inventory tracking has been removed; drop its leftover keys from an older file rather than
  // carry dead data forever.
  const legacy = db as unknown as Record<string, unknown>;
  delete legacy.inventory;
  delete legacy.movements;
  return db;
}

async function load(): Promise<Database> {
  try {
    const raw = await readFile(DB_FILE, "utf8");
    return migrate(JSON.parse(raw) as Database);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return seed();
    throw error;
  }
}

/** Read-only view of the store. Treat the result as immutable — writers use `mutate()`. */
export async function getDb(): Promise<Database> {
  if (holder.db) return holder.db;
  holder.loading ??= load().then(
    (db) => {
      holder.db = db;
      return db;
    },
    (error) => {
      holder.loading = null; // let the next request retry instead of caching the failure
      throw error;
    },
  );
  return holder.loading;
}

/** Runs `fn` against a copy of the store, then saves and publishes it. Writers never interleave. */
export function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = holder.queue.then(async () => {
    const draft = structuredClone(await getDb());
    const result = await fn(draft);
    await persist(draft);
    holder.db = draft;
    return result;
  });
  // Keep the queue alive after a failure so one bad write cannot wedge every later one.
  holder.queue = run.catch(() => undefined);
  return run;
}

export const categories = CATEGORIES;

const AUDIT_LIMIT = 1000;

/** Append to the audit trail from inside a `mutate()` callback. */
export function recordAudit(
  db: Database,
  actor: { id: string; name: string } | null,
  action: string,
  detail: string,
) {
  db.audit.unshift({
    id: randomId("aud"),
    at: new Date().toISOString(),
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "System",
    action,
    detail: detail.slice(0, 300),
  });
  if (db.audit.length > AUDIT_LIMIT) db.audit.length = AUDIT_LIMIT;
}
