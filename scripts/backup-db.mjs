// Read-only backup: dumps every table to one JSON file under .data/backups/ (gitignored).
// Uses the same DATABASE_URL Prisma loads from .env. Never prints the connection string.
//   node scripts/backup-db.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const models = ["user", "session", "menuItem", "deal", "order", "auditEntry", "settings"];

try {
  const dump = { takenAt: new Date().toISOString(), tables: {} };
  for (const model of models) {
    dump.tables[model] = await prisma[model].findMany();
    console.log(`${model.padEnd(12)} ${dump.tables[model].length} rows`);
  }
  const dir = path.join(process.cwd(), ".data", "backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `backup-${dump.takenAt.replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify(dump, null, 2), { mode: 0o600 });
  console.log(`\nBackup written to ${file}`);
} finally {
  await prisma.$disconnect();
}
