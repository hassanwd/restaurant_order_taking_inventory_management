import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

/**
 * Every POS screen is rendered per request on the server — a cached shell would
 * show stale order counts on the badges.
 */
export const dynamic = "force-dynamic";

const clock = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function ShellLayout({ children }: LayoutProps<"/">) {
  const serverTime = clock.format(new Date());

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar serverTime={serverTime} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
