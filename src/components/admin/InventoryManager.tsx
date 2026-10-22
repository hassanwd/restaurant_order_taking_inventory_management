"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Flame, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Modal from "@/components/ui/Modal";
import { Card, EmptyState, Field, Input, SectionTitle, Select } from "@/components/ui/primitives";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { InventoryItem, InventoryMovement, MovementType } from "@/lib/types";
import { useServerAction } from "@/lib/useServerAction";
import {
  createInventoryItemAction,
  deleteInventoryItemAction,
  recordMovementAction,
} from "@/server/actions/admin";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/slices/uiSlice";

const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: "Stock in",
  out: "Stock out",
  usage: "Daily usage",
};

const MOVEMENT_TONE: Record<MovementType, string> = {
  in: "bg-success-soft text-success",
  out: "bg-warning-soft text-warning",
  usage: "bg-info-soft text-info",
};

const num = (value: number) => (Math.round(value * 1000) / 1000).toString();

function MovementModal({
  items,
  initialItemId,
  initialType,
  onClose,
  onDone,
}: {
  items: InventoryItem[];
  initialItemId: string;
  initialType: MovementType;
  onClose: () => void;
  onDone: () => void;
}) {
  const { call, pending } = useServerAction();
  const [itemId, setItemId] = useState(initialItemId);
  const [type, setType] = useState<MovementType>(initialType);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const item = items.find((entry) => entry.id === itemId);

  const submit = async () => {
    setError(null);
    const result = await call(() => recordMovementAction({ itemId, type, quantity: Number(quantity), note }));
    if (!result.ok) return setError(result.error);
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Record stock movement"
      subtitle="Every movement is saved with your name and the balance after it."
      footer={
        <div className="flex items-center justify-between gap-3">
          {error ? (
            <p role="alert" className="text-xs font-semibold text-danger">
              {error}
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !quantity || Number(quantity) <= 0}>
              {pending ? "Saving…" : "Save movement"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <SegmentedControl
          size="sm"
          options={[
            { value: "in" as MovementType, label: "Stock in", icon: ArrowDownToLine },
            { value: "out" as MovementType, label: "Stock out", icon: ArrowUpFromLine },
            { value: "usage" as MovementType, label: "Daily usage", icon: Flame },
          ]}
          value={type}
          onChange={setType}
        />
        <Field label="Item">
          <Select value={itemId} onChange={(event) => setItemId(event.target.value)}>
            {items.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} — {num(entry.quantity)} {entry.unit} on hand
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Quantity${item ? ` (${item.unit})` : ""}`} required>
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            autoFocus
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>
        <Field
          label="Note"
          hint={
            type === "in"
              ? "e.g. supplier, invoice number"
              : type === "out"
                ? "e.g. transfer, wastage, spoilage"
                : "e.g. lunch service prep"
          }
        >
          <Input value={note} maxLength={120} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function AddItemModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { call, pending } = useServerAction();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [quantity, setQuantity] = useState("0");
  const [reorder, setReorder] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const result = await call(() =>
      createInventoryItemAction({ name, unit, quantity: Number(quantity) || 0, reorderLevel: Number(reorder) || 0 }),
    );
    if (!result.ok) return setError(result.error);
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add inventory item"
      footer={
        <div className="flex items-center justify-between gap-3">
          {error ? (
            <p role="alert" className="text-xs font-semibold text-danger">
              {error}
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !name.trim() || !unit.trim()}>
              {pending ? "Saving…" : "Add item"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name" required>
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tomato puree" autoFocus />
          </Field>
        </div>
        <Field label="Unit" required hint="kg, L, pcs…">
          <Input value={unit} maxLength={12} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label="Opening quantity">
          <Input type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Reorder level" hint="You are warned when stock falls to this level">
            <Input type="number" min={0} step="any" value={reorder} onChange={(e) => setReorder(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function InventoryManager({
  items,
  movements,
  today,
}: {
  items: InventoryItem[];
  movements: InventoryMovement[];
  /** `YYYY-MM-DD` (UTC), supplied by the server so the daily columns match its clock. */
  today: string;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { call, pending } = useServerAction();
  const [movement, setMovement] = useState<{ itemId: string; type: MovementType } | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const daily = useMemo(() => {
    const map = new Map<string, { in: number; out: number; usage: number }>();
    for (const entry of movements) {
      if (entry.at.slice(0, 10) !== today) continue;
      const bucket = map.get(entry.itemId) ?? { in: 0, out: 0, usage: 0 };
      bucket[entry.type] += entry.quantity;
      map.set(entry.itemId, bucket);
    }
    return map;
  }, [movements, today]);

  const low = items.filter((item) => item.quantity <= item.reorderLevel);

  const done = (message: string) => {
    dispatch(showToast({ message }));
    router.refresh();
  };

  const remove = async () => {
    if (!deleting) return;
    const result = await call(() => deleteInventoryItemAction(deleting.id));
    if (!result.ok) return setError(result.error);
    const name = deleting.name;
    setDeleting(null);
    setError(null);
    done(`${name} removed from inventory`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Inventory</h2>
          <p className="text-xs text-fg-muted">
            Incoming and outgoing stock, daily usage and what is left on the shelf.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            Add item
          </Button>
          <Button disabled={items.length === 0} onClick={() => items[0] && setMovement({ itemId: items[0].id, type: "in" })}>
            <ArrowDownToLine className="size-4" aria-hidden />
            Record movement
          </Button>
        </div>
      </div>

      {low.length > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Running low: {low.map((item) => `${item.name} (${num(item.quantity)} ${item.unit})`).join(", ")}
          </span>
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState icon={Boxes} title="No inventory items" description="Add your first item to start tracking stock." action={<Button onClick={() => setAdding(true)}>Add item</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">Item</th>
                  <th className="px-3 py-3 text-right font-bold">In today</th>
                  <th className="px-3 py-3 text-right font-bold">Out today</th>
                  <th className="px-3 py-3 text-right font-bold">Used today</th>
                  <th className="px-3 py-3 text-right font-bold">Remaining</th>
                  <th className="px-5 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => {
                  const totals = daily.get(item.id) ?? { in: 0, out: 0, usage: 0 };
                  const isLow = item.quantity <= item.reorderLevel;
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <p className="font-bold text-fg">{item.name}</p>
                        <p className="text-[11px] text-fg-subtle">
                          Reorder at {num(item.reorderLevel)} {item.unit}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-success">{totals.in ? `+${num(totals.in)}` : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-warning">{totals.out ? `−${num(totals.out)}` : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-info">{totals.usage ? `−${num(totals.usage)}` : "—"}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={cn("font-bold tabular-nums", isLow ? "text-danger" : "text-fg")}>
                          {num(item.quantity)} {item.unit}
                        </span>
                        {isLow ? (
                          <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase text-danger">Low</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setMovement({ itemId: item.id, type: "in" })}>
                            Receive
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setMovement({ itemId: item.id, type: "usage" })}>
                            Use
                          </Button>
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setDeleting(item);
                            }}
                            aria-label={`Delete ${item.name}`}
                            className="grid size-9 cursor-pointer place-items-center rounded-lg text-fg-muted transition-all duration-150 hover:bg-danger-soft hover:text-danger active:scale-90"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionTitle title="Movement history" subtitle="Latest 30 records — the full history feeds the inventory report" />
        </div>
        {movements.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No movements recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {movements.slice(0, 30).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide", MOVEMENT_TONE[entry.type])}>
                  {MOVEMENT_LABEL[entry.type]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-fg">{entry.itemName}</span>
                  <span className="text-fg-muted">
                    {" "}
                    · {entry.type === "in" ? "+" : "−"}
                    {num(entry.quantity)} → {num(entry.balanceAfter)} left
                    {entry.note ? ` · ${entry.note}` : ""}
                  </span>
                </span>
                <span className="text-[11px] text-fg-subtle">
                  {entry.byName} · {formatDateTime(entry.at)} UTC
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {movement ? (
        <MovementModal
          items={items}
          initialItemId={movement.itemId}
          initialType={movement.type}
          onClose={() => setMovement(null)}
          onDone={() => {
            setMovement(null);
            done("Stock movement recorded");
          }}
        />
      ) : null}
      {adding ? (
        <AddItemModal
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            done("Inventory item added");
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmModal
          title={`Delete ${deleting.name}?`}
          message={`${num(deleting.quantity)} ${deleting.unit} is currently on hand. The movement history stays in the records.`}
          confirmLabel="Delete item"
          pending={pending}
          error={error}
          onConfirm={() => void remove()}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
