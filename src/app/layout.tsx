import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeSync, { THEME_KEY } from "@/components/layout/ThemeSync";
import Toaster from "@/components/ui/Toaster";
import { OUTLET } from "@/data/settings";
import { getOrders } from "@/server/data";
import StatePersistence from "@/store/StatePersistence";
import StoreProvider from "@/store/StoreProvider";
import { initialOrdersState } from "@/store/slices/ordersSlice";
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
  // Rendered on the server on every request and handed to Redux as preloaded
  // state, so the very first HTML already contains real order data.
  const orders = await getOrders();

  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full">
        <StoreProvider
          preloadedState={{ orders: { ...initialOrdersState, items: orders } }}
        >
          <ThemeSync />
          <StatePersistence />
          {children}
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
