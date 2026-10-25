import "server-only";

import { PrismaClient } from "@prisma/client";

/**
 * One Postgres connection pool per process. Dev servers load this module once per bundle, so the
 * client is hung off `globalThis` the same way the old file-backed store was — Fast Refresh must
 * not open a fresh pool on every edit.
 */
const globalForPrisma = globalThis as unknown as { __otsPrisma?: PrismaClient };

export const prisma = globalForPrisma.__otsPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__otsPrisma = prisma;
