import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import type {
  AuditEntry as PrismaAuditEntry,
  Deal as PrismaDeal,
  MenuItem as PrismaMenuItem,
  Order as PrismaOrder,
  Session as PrismaSession,
  User as PrismaUser,
} from "@prisma/client";
import { CATEGORIES } from "@/data/menu";
import { DEFAULT_PRICING } from "@/data/settings";
import type {
  AuditEntry,
  CartLine,
  Customer,
  Deal,
  DealComponent,
  MenuItem,
  Order,
  OptionGroup,
  OrderReturn,
  OrderTotals,
  PaymentDetails,
  Role,
} from "@/lib/types";
import { prisma } from "./prisma";
import { hashPassword, randomId } from "./security";

/**
 * Postgres-backed data store.
 *
 * Everything the app persists lives in the `fastfood` (or whatever `DATABASE_URL` points at)
 * database. `recordAudit` and the mappers below are the thin, shared boundary between Prisma's
 * generated row types (plain Dates, untyped Json columns) and the app's own TS interfaces
 * (ISO date strings, typed nested shapes) used everywhere else in the codebase.
 */

export const DATA_DIR = process.env.OTS_DATA_DIR ?? path.join(process.cwd(), ".data");

export const categories = CATEGORIES;

export type Tx = Prisma.TransactionClient;

const AUDIT_DETAIL_LIMIT = 300;

/** Append to the audit trail — call from inside the same transaction as the change it records. */
export async function recordAudit(
  tx: Tx,
  actor: { id: string; name: string } | null,
  action: string,
  detail: string,
) {
  await tx.auditEntry.create({
    data: {
      id: randomId("aud"),
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? "System",
      action,
      detail: detail.slice(0, AUDIT_DETAIL_LIMIT),
    },
  });
}

/* ---------------------------------------------------------- Prisma row → app type mappers */

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

export function mapUser(row: PrismaUser): UserRecord {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role as Role,
    passwordHash: row.passwordHash,
    frozen: row.frozen,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    failedAttempts: row.failedAttempts,
    lockedUntil: row.lockedUntil?.toISOString() ?? null,
  };
}

export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export function mapSession(row: PrismaSession): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export function mapMenuItem(row: PrismaMenuItem): MenuItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    categoryId: row.categoryId,
    image: row.image,
    ingredients: row.ingredients,
    prepMinutes: row.prepMinutes,
    available: row.available,
    tags: row.tags,
    popular: row.popular,
    optionGroups: row.optionGroups as unknown as OptionGroup[],
  };
}

export function mapDeal(row: PrismaDeal): Deal {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    items: row.items as unknown as DealComponent[],
    image: row.image,
    ingredients: row.ingredients,
    optionGroups: row.optionGroups as unknown as OptionGroup[],
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  };
}

export function mapOrder(row: PrismaOrder): Order {
  return {
    id: row.id,
    code: row.code,
    type: row.type as Order["type"],
    tableId: row.tableId,
    guests: row.guests,
    customer: row.customer as unknown as Customer,
    lines: row.lines as unknown as CartLine[],
    notes: row.notes,
    discountPercent: row.discountPercent,
    totals: row.totals as unknown as OrderTotals,
    status: row.status as Order["status"],
    payment: row.payment as unknown as PaymentDetails | null,
    paidAt: row.paidAt?.toISOString() ?? null,
    cashier: row.cashier,
    createdById: row.createdById,
    returned: row.returned as unknown as OrderReturn | null,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAudit(row: PrismaAuditEntry): AuditEntry {
  return {
    id: row.id,
    at: row.at.toISOString(),
    actorId: row.actorId,
    actorName: row.actorName,
    action: row.action,
    detail: row.detail,
  };
}

/* ------------------------------------------------------------------------- first-run seed */

let seeding: Promise<void> | null = null;

/**
 * Fixed so they're known up front — handy on a serverless deploy where there's no disk to read a
 * generated-password file back from. Override any of them with `OTS_SEED_*_PASSWORD` env vars
 * before first boot if you want different ones; otherwise change them from the account menu right
 * after your first sign-in, since these are the same for every deployment of this codebase.
 */
const SEED_PASSWORDS = {
  super_admin: process.env.OTS_SEED_SUPERADMIN_PASSWORD ?? "SuperAdmin123!",
  admin: process.env.OTS_SEED_CASHIER_PASSWORD ?? "Cashier123!",
  worker: process.env.OTS_SEED_WAITER_PASSWORD ?? "Waiter123!",
} as const;

/**
 * Creates the three starter accounts and default pricing the very first time the app talks to an
 * empty database. Safe to call on every request — after the first call it is a single cached no-op
 * promise for the lifetime of the process, and a fresh process checks `settings` before doing
 * anything, so re-running it (a redeploy, a second serverless instance racing on cold start) just
 * finds the row already there and returns.
 */
export function ensureSeeded(): Promise<void> {
  seeding ??= (async () => {
    const already = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (already) return;

    const accounts: { name: string; username: string; role: Role; password: string }[] = [
      { name: "Hassan K.", username: "superadmin", role: "super_admin", password: SEED_PASSWORDS.super_admin },
      { name: "Sara Ahmed", username: "cashier", role: "admin", password: SEED_PASSWORDS.admin },
      { name: "Bilal Raza", username: "waiter", role: "worker", password: SEED_PASSWORDS.worker },
    ];
    const withHashes = await Promise.all(
      accounts.map(async (account) => ({ ...account, passwordHash: await hashPassword(account.password) })),
    );

    try {
      await prisma.$transaction(async (tx) => {
        for (const account of withHashes) {
          await tx.user.create({
            data: {
              id: randomId("usr"),
              name: account.name,
              username: account.username,
              role: account.role,
              passwordHash: account.passwordHash,
            },
          });
        }
        await tx.settings.create({
          data: {
            id: "singleton",
            pricing: DEFAULT_PRICING as unknown as Prisma.InputJsonValue,
            orderCounter: 1000,
          },
        });
      });
    } catch (error) {
      // Another process won the race to seed first (concurrent cold starts) — nothing to do.
      if ((error as { code?: string }).code === "P2002") return;
      throw error;
    }

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
    // Best-effort only: a serverless deploy's filesystem is read-only outside /tmp, and the
    // credentials are fixed/known anyway now — a failed write here must never fail the seed
    // itself, since the accounts above are already committed by this point.
    try {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(path.join(DATA_DIR, "initial-credentials.txt"), credentials, { mode: 0o600 });
    } catch {
      // No writable disk here — the fixed passwords above are already known, so nothing is lost.
    }
    console.log(`\n[ots] First start — seeded the database.\n${credentials}`);
  })();
  return seeding;
}
