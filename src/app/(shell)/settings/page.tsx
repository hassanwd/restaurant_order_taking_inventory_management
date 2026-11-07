import PricingForm from "@/components/admin/PricingForm";
import { getPricing } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("pricing.manage");
  const pricing = await getPricing();

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-fg">Settings</h2>
        <p className="text-xs text-fg-muted">
          GST, service charge and the bill discount. Waiters see these on every order but cannot change them.
        </p>
      </div>
      <PricingForm pricing={pricing} />
    </div>
  );
}
