"use server";

import { z } from "zod";
import { isRole } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { mutate, recordAudit, type Database } from "../db";
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
function activeSuperAdmins(db: Database, excludingId?: string) {
  return db.users.filter(
    (user) => user.role === "super_admin" && !user.frozen && user.id !== excludingId,
  ).length;
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

    await mutate((db) => {
      if (db.users.some((user) => user.username === data.username)) {
        throw new ActionError("That username is already taken.");
      }
      db.users.push({
        id: randomId("usr"),
        name: data.name,
        username: data.username,
        role: data.role as Role,
        passwordHash,
        frozen: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        failedAttempts: 0,
        lockedUntil: null,
      });
      recordAudit(db, actor, "employee.create", `${data.name} (@${data.username}) as ${data.role}`);
    });
    return { ok: true };
  });
}

export async function setEmployeeFrozenAction(id: string, frozen: boolean): Promise<ActionResult> {
  return run(async () => {
    const actor = await authorize("employees.manage");
    const username = await mutate((db) => {
      const target = db.users.find((user) => user.id === String(id));
      if (!target) throw new ActionError("Employee not found.");
      if (target.id === actor.id) throw new ActionError("You cannot freeze your own account.");
      if (frozen && target.role === "super_admin" && activeSuperAdmins(db, target.id) === 0) {
        throw new ActionError("At least one Super Admin must stay active.");
      }
      target.frozen = Boolean(frozen);
      if (!frozen) {
        target.failedAttempts = 0;
        target.lockedUntil = null;
      } else {
        // Freezing takes effect immediately — their open sessions are destroyed too.
        revokeSessions(db, target.id);
      }
      recordAudit(db, actor, frozen ? "employee.freeze" : "employee.unfreeze", `${target.name} (@${target.username})`);
      return target.username;
    });
    if (!frozen) clearHits(`login:user:${username}`);
    return { ok: true };
  });
}

export async function deleteEmployeeAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await authorize("employees.manage");
    await mutate((db) => {
      const target = db.users.find((user) => user.id === String(id));
      if (!target) throw new ActionError("Employee not found.");
      if (target.id === actor.id) throw new ActionError("You cannot delete your own account.");
      if (target.role === "super_admin" && activeSuperAdmins(db, target.id) === 0) {
        throw new ActionError("At least one Super Admin must stay active.");
      }
      revokeSessions(db, target.id);
      db.users = db.users.filter((user) => user.id !== target.id);
      // Their orders stay in the records, attributed by the name snapshot on each order.
      recordAudit(db, actor, "employee.delete", `${target.name} (@${target.username})`);
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
    const username = await mutate((db) => {
      const target = db.users.find((user) => user.id === data.id);
      if (!target) throw new ActionError("Employee not found.");
      target.passwordHash = passwordHash;
      target.failedAttempts = 0;
      target.lockedUntil = null;
      revokeSessions(db, target.id);
      recordAudit(db, actor, "employee.reset", `Password reset for ${target.name} (@${target.username})`);
      return target.username;
    });
    // A reset is the sanctioned way out of a lockout, so the in-memory attempt counter goes too.
    clearHits(`login:user:${username}`);
    return { ok: true };
  });
}
