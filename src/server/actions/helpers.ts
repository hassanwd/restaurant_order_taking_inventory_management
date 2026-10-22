import "server-only";

import { z } from "zod";
import { can, type Permission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { getCurrentUser } from "../session";

/** Raised for anything the user should be told about; everything else becomes a generic failure. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly unauthenticated = false,
  ) {
    super(message);
  }
}

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; unauthenticated?: boolean };

/**
 * First line of defence in every Server Action. Server Actions are public HTTP
 * endpoints: hiding a button is not access control, so each one re-checks that
 * the caller is signed in *and* holds the permission, using the stored account.
 */
export async function authorize(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("Your session has expired. Please sign in again.", true);
  if (!can(user.role, permission)) throw new ActionError("You do not have permission to do that.");
  return user;
}

/** Wraps an action body: user-facing errors pass through, anything else is logged and hidden. */
export async function run<T extends object = object>(
  body: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof ActionError) {
      return { ok: false, error: error.message, unauthenticated: error.unauthenticated || undefined };
    }
    console.error("[ots] action failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ActionError(result.error.issues[0]?.message ?? "Some of the details are invalid.");
  }
  return result.data;
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Trimmed, control-character-free text with a hard length cap. Newlines only when `multiline`. */
export const cleanText = (max: number, label: string, multiline = false) =>
  z
    .string({ error: `${label} is required.` })
    .transform((value) => {
      const stripped = value.replace(CONTROL, "");
      return (multiline ? stripped : stripped.replace(/[\r\n\t]+/g, " ")).trim();
    })
    .pipe(z.string().max(max, `${label} must be at most ${max} characters.`));

export const requiredText = (min: number, max: number, label: string) =>
  cleanText(max, label).pipe(z.string().min(min, `${label} must be at least ${min} characters.`));

export const money = (label: string, max = 100000) =>
  z
    .number({ error: `${label} must be a number.` })
    .finite(`${label} must be a number.`)
    .min(0, `${label} cannot be negative.`)
    .max(max, `${label} is too large.`);

export const quantity = (label: string, max = 1_000_000) =>
  z
    .number({ error: `${label} must be a number.` })
    .finite(`${label} must be a number.`)
    .positive(`${label} must be greater than zero.`)
    .max(max, `${label} is too large.`);
