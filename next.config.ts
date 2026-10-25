import type { NextConfig } from "next";

const securityHeaders = [
  // Never framed — blocks clickjacking of the POS screens.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Ignored over plain http, so it is safe to send everywhere; it pins browsers to https once seen on it.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Do not advertise the framework version.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Room for a compressed menu photo plus multipart overhead; uploadImageAction separately
      // rejects anything over 5MB once decoded, so this is just transport headroom, not the limit.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Authenticated pages hold order and billing data — keep them out of shared and back/forward caches.
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        // Overrides the no-store rule above: an uploaded photo is named by its own content hash, so
        // the same URL can never later serve different bytes — safe for browsers to cache forever.
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
