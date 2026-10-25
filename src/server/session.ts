import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, type Permission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { ensureSeeded, type Tx } from "./db";
import { prisma } from "./prisma";
import { hashToken, newSessionToken } from "./security";

const secure = process.env.NODE_ENV === "production" && process.env.OTS_INSECURE_COOKIES !== "1";
/** `__Host-` pins the cookie to this exact origin and path — it cannot be set by a subdomain. */
export const SESSION_COOKIE = secure ? "__Host-ots_session" : "ots_session";

/** Signed out after this long without activity… */
const IDLE_MS = 8 * 60 * 60 * 1000;
/** …and always after this long, however active. */
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
/** `lastSeenAt` is only rewritten this often, so reading a page is not a disk write. */
const TOUCH_MS = 5 * 60 * 1000;

const cookieOptions = (maxAgeSeconds: number) =>
  ({
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  }) as const;

/** Creates a session for `userId` (inside an existing transaction), returning the cookie token. */
export async function openSession(tx: Tx, userId: string) {
  const now = new Date();
  // Drop anything already dead so the table stays small.
  await tx.session.deleteMany({ where: { expiresAt: { lte: now } } });

  const token = newSessionToken();
  await tx.session.create({
    data: {
      id: hashToken(token),
      userId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + ABSOLUTE_MS),
    },
  });
  return token;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(ABSOLUTE_MS / 1000));
}

export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, "", cookieOptions(0));
}

export async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/** Revokes every session of a user — used on freeze, delete, and password change/reset. */
export async function revokeSessions(tx: Tx, userId: string, exceptSessionId?: string | null) {
  await tx.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}

/**
 * The signed-in employee, or null. This is the real authentication check: it runs
 * on every render and every action, and consults the stored user — so freezing or
 * deleting an account ends their access on the very next request, not at expiry.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  await ensureSeeded();

  const id = await currentSessionId();
  if (!id) return null;

  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || now - session.lastSeenAt.getTime() > IDLE_MS) {
    return null;
  }

  const user = session.user;
  if (!user || user.frozen) return null;

  if (now - session.lastSeenAt.getTime() > TOUCH_MS) {
    await prisma.session.update({ where: { id }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
  }

  return { id: user.id, name: user.name, username: user.username, role: user.role as SessionUser["role"] };
});

/** For pages and layouts: redirects to the sign-in screen when nobody is signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: signed in *and* allowed. Everyone else is sent home rather than shown the screen. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/?denied=1");
  return user;
}
