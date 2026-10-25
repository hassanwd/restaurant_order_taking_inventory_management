"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureSeeded, recordAudit } from "../db";
import { prisma } from "../prisma";
import {
  clearHits,
  decoyHash,
  hashPassword,
  isLimited,
  passwordProblem,
  recordHit,
  verifyPassword,
} from "../security";
import {
  clearSessionCookie,
  currentSessionId,
  getCurrentUser,
  openSession,
  revokeSessions,
  setSessionCookie,
} from "../session";
import { ActionError, run, type ActionResult } from "./helpers";

const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MESSAGE = "Too many failed attempts. Please wait 15 minutes and try again.";

export interface LoginState {
  error?: string;
  username?: string;
}

/** Only same-site paths — stops `?next=https://evil.example` and `//evil.example` redirects. */
function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}

async function clientAddress() {
  const store = await headers();
  return store.get("x-forwarded-for")?.split(",")[0]?.trim() || store.get("x-real-ip") || "local";
}

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(256),
});

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  await ensureSeeded();

  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter your username and password." };
  const { username, password } = parsed.data;

  const ip = await clientAddress();
  const ipKey = `login:ip:${ip}`;
  const userKey = `login:user:${username}`;
  if (isLimited(ipKey, 30, WINDOW_MS) || isLimited(userKey, LOCK_AFTER, WINDOW_MS)) {
    return { error: LOCK_MESSAGE, username };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const now = Date.now();

  if (user?.lockedUntil && user.lockedUntil.getTime() > now) {
    return { error: LOCK_MESSAGE, username };
  }

  // Always run a full scrypt — against a decoy when the user is unknown — so timing does not reveal valid usernames.
  const valid = await verifyPassword(password, user ? user.passwordHash : await decoyHash());

  if (!user || !valid) {
    recordHit(ipKey, WINDOW_MS);
    recordHit(userKey, WINDOW_MS);
    await prisma.$transaction(async (tx) => {
      const record = await tx.user.findUnique({ where: { username } });
      if (record) {
        const failedAttempts = record.failedAttempts + 1;
        await tx.user.update({
          where: { id: record.id },
          data:
            failedAttempts >= LOCK_AFTER
              ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
              : { failedAttempts },
        });
      }
      // Unknown usernames are not echoed: people sometimes type their password into that box.
      await recordAudit(
        tx,
        null,
        "login.failed",
        record ? `Failed sign-in for "${username}" from ${ip}` : `Failed sign-in for an unknown username from ${ip}`,
      );
    });
    return { error: "Invalid username or password.", username };
  }

  // The password was right, so telling them about a frozen account leaks nothing.
  if (user.frozen) {
    await prisma.$transaction((tx) =>
      recordAudit(tx, user, "login.blocked", `Frozen account "${username}" tried to sign in`),
    );
    return { error: "This account has been frozen. Please contact your administrator.", username };
  }

  const token = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await recordAudit(tx, user, "login", `Signed in from ${ip}`);
    // A brand-new token on every sign-in — never reuse one — defeats session fixation.
    return openSession(tx, user.id);
  });

  clearHits(userKey);
  await setSessionCookie(token);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction() {
  const user = await getCurrentUser();
  const sessionId = await currentSessionId();
  if (sessionId) {
    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { id: sessionId } });
      if (user) await recordAudit(tx, user, "logout", "Signed out");
    });
  }
  await clearSessionCookie();
  redirect("/login");
}

const changePasswordSchema = z.object({
  current: z.string().min(1, "Enter your current password.").max(256),
  next: z.string().max(256),
});

export async function changePasswordAction(input: {
  current: string;
  next: string;
}): Promise<ActionResult> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ActionError("Your session has expired. Please sign in again.", true);

    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);

    const problem = passwordProblem(parsed.data.next);
    if (problem) throw new ActionError(problem);

    const key = `pwchange:${user.id}`;
    if (isLimited(key, 5, WINDOW_MS)) throw new ActionError(LOCK_MESSAGE);

    const record = await prisma.user.findUnique({ where: { id: user.id } });
    if (!record || !(await verifyPassword(parsed.data.current, record.passwordHash))) {
      recordHit(key, WINDOW_MS);
      throw new ActionError("Your current password is not correct.");
    }
    if (parsed.data.current === parsed.data.next) {
      throw new ActionError("Choose a password you have not used just now.");
    }

    const passwordHash = await hashPassword(parsed.data.next);
    const keep = await currentSessionId();
    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: user.id } });
      if (!target) throw new ActionError("Account not found.");
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      // Anyone else holding a session for this account is signed out.
      await revokeSessions(tx, user.id, keep);
      await recordAudit(tx, user, "password.change", "Changed their own password");
    });
    clearHits(key);
    return { ok: true };
  });
}
