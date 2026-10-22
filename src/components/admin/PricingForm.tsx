"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, Chip, Field, Input, SectionTitle } from "@/components/ui/primitives";
import { ORDER_TYPE_LABEL } from "@/lib/format";
import type { OrderType, Pricing } from "@/lib/types";
import { useServerAction } from "@/lib/useServerAction";
import { updatePricingAction } from "@/server/actions/admin";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/slices/uiSlice";

const ORDER_TYPES: OrderType[] = ["dine-in", "takeaway", "parcel"];

/** Tax / GST and charge settings. New values apply to bills created or settled from now on — never to past bills. */
export default function PricingForm({ pricing }: { pricing: Pricing }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { call, pending } = useServerAction();
  const [cash, setCash] = useState(String(pricing.taxRateCash));
  const [card, setCard] = useState(String(pricing.taxRateCard));
  const [service, setService] = useState(String(pricing.serviceChargeRate));
  const [appliesTo, setAppliesTo] = useState<OrderType[]>(pricing.serviceChargeAppliesTo);
  const [parcelFee, setParcelFee] = useState(String(pricing.parcelFee));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const result = await call(() =>
      updatePricingAction({
        taxRateCash: Number(cash),
        taxRateCard: Number(card),
        serviceChargeRate: Number(service),
        serviceChargeAppliesTo: appliesTo,
        parcelFee: Number(parcelFee),
      }),
    );
    if (!result.ok) return setError(result.error);
    dispatch(showToast({ message: "Tax settings saved" }));
    router.refresh();
  };

  return (
    <Card className="p-5">
      <SectionTitle
        title="Tax / GST settings"
        subtitle="GST is applied by how a bill is settled. Changes affect new bills only."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="GST · cash (%)">
          <Input type="number" min={0} max={50} step="0.1" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
        </Field>
        <Field label="GST · card (%)">
          <Input type="number" min={0} max={50} step="0.1" inputMode="decimal" value={card} onChange={(e) => setCard(e.target.value)} />
        </Field>
        <Field label="Service charge (%)">
          <Input type="number" min={0} max={30} step="0.1" inputMode="decimal" value={service} onChange={(e) => setService(e.target.value)} />
        </Field>
        <Field label="Parcel fee">
          <Input type="number" min={0} max={1000} step="0.05" inputMode="decimal" value={parcelFee} onChange={(e) => setParcelFee(e.target.value)} />
        </Field>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
          Service charge applies to
        </p>
        <div className="flex flex-wrap gap-2">
          {ORDER_TYPES.map((type) => (
            <Chip
              key={type}
              active={appliesTo.includes(type)}
              onClick={() =>
                setAppliesTo((current) =>
                  current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type],
                )
              }
            >
              {ORDER_TYPE_LABEL[type]}
            </Chip>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={pending}>
          <Save className="size-4" aria-hidden />
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </Card>
  );
}
