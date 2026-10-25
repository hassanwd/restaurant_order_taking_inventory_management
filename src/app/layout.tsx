import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeSync, { THEME_KEY } from "@/components/layout/ThemeSync";
import Toaster from "@/components/ui/Toaster";
import { OUTLET } from "@/data/settings";
import { getPricing } from "@/server/data";
import { getCurrentUser } from "@/server/session";
import ServerSync from "@/store/ServerSync";
import StatePersistence from "@/store/StatePersistence";
import StoreProvider from "@/store/StoreProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${OUTLET.name} · Order Taking System`,
    template: `%s · ${OUTLET.name}`,
  },
  description:
    "Point-of-sale order taking system: build orders, take payment and print receipts and kitchen tickets.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ff7a1a" },
    { media: "(prefers-color-scheme: dark)", color: "#141110" },
  ],
};

/**
 * Applies the saved theme before first paint so the server-rendered markup is
 * never repainted from light to dark.
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading the request headers makes every route dynamic, which the per-request
  // CSP nonce requires. The nonce is minted by src/proxy.ts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // Who is signed in and the live tax settings are read on the server and handed to
  // Redux as preloaded state, so the very first HTML already reflects them.
  const [user, pricing] = await Promise.all([getCurrentUser(), getPricing()]);

  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      {/* suppressHydrationWarning: some browser extensions (e.g. ColorZilla's cz-shortcut-listen)
          add an attribute to <body> before React hydrates; that mismatch is theirs, not ours. */}
      <body className="min-h-full" suppressHydrationWarning>
        <StoreProvider preloadedState={{ config: { user, pricing } }}>
          <ThemeSync />
          <ServerSync user={user} pricing={pricing} />
          <StatePersistence />
          {children}
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
