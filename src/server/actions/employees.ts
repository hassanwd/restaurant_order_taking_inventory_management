"use server";

import { z } from "zod";
import { isRole } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { recordAudit, type Tx } from "../db";
import { prisma } from "../prisma";
import { clearHits, hashPassword, passwordProblem, randomId } from "../security";
import { revokeSessions } from "../session";
import { ActionError, authorize, parse, requiredText, run, type ActionResult } from "./helpers";

const createSchema = z.object({
  name: requiredText(2, 60, "Name"),
  username: z
    .string({ error: "Username is required." })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Username must be 3–32 letters, numbers, dots, dashes or underscores."),
  role: z.string().refine(isRole, { message: "Choose a role." }),
  password: z.string().max(128),
});

/** A system with no active super admin cannot be administered, so the last one is protected. */
async function activeSuperAdmins(tx: Tx, excludingId?: string) {
  return tx.user.count({
    where: { role: "super_admin", frozen: false, id: excludingId ? { not: excludingId } : undefined },
  });
}

export async function createEmployeeAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await authorize("employees.manage");
    const data = parse(createSchema, input);
    const problem = passwordProblem(data.password);
    if (problem) throw new ActionError(problem);
    const passwordHash = await hashPassword(data.password);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { username: data.username } });
      if (existing) throw new ActionError("That username is already taken.");
      await tx.user.create({
        data: {
          id: randomId("usr"),
          name: data.name,
          username: data.username,
          role: data.role as Role,
          passwordHash,
        },
      });
      await recordAudit(tx, actor, "employee.create", `${data.name} (@${data.username}) as ${data.role}`);
    });
    return { ok: true };
  });
}

export async function setEmployeeFrozenAction(id: string, frozen: boolean): Promise<ActionResult> {
  return run(async () => {
    const actor = await authorize("employees.manage");
    const next = Boolean(frozen);
    const username = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: String(id) } });
      if (!target) throw new ActionError("Employee not found.");
      if (target.id === actor.id) throw new ActionError("You cannot freeze your own account.");
      if (next && target.role === "super_admin" && (await activeSuperAdmins(tx, target.id)) === 0) {
        throw new ActionError("At least one Super Admin must stay active.");
      }
      await tx.user.update({
        where: { id: target.id },
        data: next ? { frozen: true } : { frozen: false, failedAttempts: 0, lockedUntil: null },
      });
      if (next) {
        // Freezing takes effect immediately — their open sessions are destroyed too.
        await revokeSessions(tx, target.id);
      }
      await recordAudit(tx, actor, next ? "employee.freeze" : "employee.unfreeze", `${target.name} (@${target.username})`);
      return target.username;
    });
    if (!next) clearHits(`login:user:${username}`);
    return { ok: true };
  });
}

export async function deleteEmployeeAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await authorize("employees.manage");
    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: String(id) } });
      if (!target) throw new ActionError("Employee not found.");
      if (target.id === actor.id) throw new ActionError("You cannot delete your own account.");
      if (target.role === "super_admin" && (await activeSuperAdmins(tx, target.id)) === 0) {
        throw new ActionError("At least one Super Admin must stay active.");
      }
      await revokeSessions(tx, target.id);
      await tx.user.delete({ where: { id: target.id } });
      // Their orders stay in the records, attributed by the name snapshot on each order.
      await recordAudit(tx, actor, "employee.delete", `${target.name} (@${target.username})`);
    });
    return { ok: true };
  });
}

const resetSchema = z.object({ id: z.string().max(60), password: z.string().max(128) });

export async function resetEmployeePasswordAction(
  input: z.input<typeof resetSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await authorize("employees.manage");
    const data = parse(resetSchema, input);
    const problem = passwordProblem(data.password);
    if (problem) throw new ActionError(problem);
    const passwordHash = await hashPassword(data.password);
    const username = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: data.id } });
      if (!target) throw new ActionError("Employee not found.");
      await tx.user.update({
        where: { id: target.id },
        data: { passwordHash, failedAttempts: 0, lockedUntil: null },
      });
      await revokeSessions(tx, target.id);
      await recordAudit(tx, actor, "employee.reset", `Password reset for ${target.name} (@${target.username})`);
      return target.username;
    });
    // A reset is the sanctioned way out of a lockout, so the in-memory attempt counter goes too.
    clearHits(`login:user:${username}`);
    return { ok: true };
  });
}
