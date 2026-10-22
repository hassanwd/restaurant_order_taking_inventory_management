import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, type Permission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { getDb, mutate, type Database } from "./db";
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

/** Creates a session for `userId` (inside an existing `mutate()`), returning the cookie token. */
export function openSession(db: Database, userId: string) {
  const now = Date.now();
  // Drop anything already dead so the table stays small.
  db.sessions = db.sessions.filter((session) => Date.parse(session.expiresAt) > now);

  const token = newSessionToken();
  db.sessions.push({
    id: hashToken(token),
    userId,
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ABSOLUTE_MS).toISOString(),
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
export function revokeSessions(db: Database, userId: string, exceptSessionId?: string | null) {
  db.sessions = db.sessions.filter(
    (session) => session.userId !== userId || session.id === exceptSessionId,
  );
}

/**
 * The signed-in employee, or null. This is the real authentication check: it runs
 * on every render and every action, and consults the stored user — so freezing or
 * deleting an account ends their access on the very next request, not at expiry.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const id = await currentSessionId();
  if (!id) return null;

  const db = await getDb();
  const session = db.sessions.find((entry) => entry.id === id);
  if (!session) return null;

  const now = Date.now();
  if (Date.parse(session.expiresAt) <= now || now - Date.parse(session.lastSeenAt) > IDLE_MS) {
    return null;
  }

  const user = db.users.find((entry) => entry.id === session.userId);
  if (!user || user.frozen) return null;

  if (now - Date.parse(session.lastSeenAt) > TOUCH_MS) {
    await mutate((draft) => {
      const live = draft.sessions.find((entry) => entry.id === id);
      if (live) live.lastSeenAt = new Date(now).toISOString();
    });
  }

  return { id: user.id, name: user.name, username: user.username, role: user.role };
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
