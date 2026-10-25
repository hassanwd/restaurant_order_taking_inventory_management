import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request. Two jobs:
 *
 * 1. A per-request Content-Security-Policy with a fresh nonce, so only scripts
 *    this server rendered can execute — injected markup cannot run script.
 * 2. An *optimistic* sign-in gate: no session cookie → straight to /login. This
 *    only saves a render; it proves nothing about who the caller is. The real
 *    check (valid, unexpired session of a non-frozen account, plus the role's
 *    permission) runs in `src/server/session.ts` on every page and action.
 */

const SESSION_COOKIES = ["__Host-ots_session", "ots_session"];

function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced Next.js bootstrap load its own chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Dev injects styles at runtime for hot reload; a nonce would make the browser ignore 'unsafe-inline'.
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // React sets a few inline style attributes (receipt barcode widths).
    "style-src-attr 'unsafe-inline'",
    // Uploaded menu/deal photos are served from Vercel Blob's public storage domain.
    "img-src 'self' blob: data: https://*.public.blob.vercel-storage.com",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Opt-in: forcing https breaks plain-http LAN and localhost use of `next start`.
    ...(process.env.OTS_FORCE_HTTPS === "1" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const signedIn = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!signedIn && pathname !== "/login") {
    const login = new URL("/login", request.url);
    if (request.method === "GET" && pathname !== "/") login.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(login);
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        // Every Server Action called imperatively (uploadImageAction, placeOrderAction, etc.)
        // sends this header. Proxy buffers/clones the whole body to let both itself and the
        // route read it, which corrupts binary payloads like an uploaded photo — and gains
        // nothing here anyway, since every action independently re-checks the session itself
        // (see the file-level comment above). Only the plain <form action={loginAction}> POST,
        // which carries no binary data, still goes through proxy.
        { type: "header", key: "next-action" },
      ],
    },
  ],
};
