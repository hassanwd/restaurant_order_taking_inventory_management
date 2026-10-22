import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { getOpenOrderCount } from "@/server/data";
import { requireUser } from "@/server/session";

/**
 * Every POS screen is rendered per request on the server — a cached shell would
 * show stale order counts on the badges. This layout is also the sign-in gate for
 * everything inside the (shell) group; each page adds its own permission check.
 */
export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const openOrders = await getOpenOrderCount(user);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* The header spans the full width; the logo in it never goes away. */}
      <Topbar user={user} />
      <div className="flex min-h-0 flex-1">
        <Sidebar user={user} openOrders={openOrders} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
