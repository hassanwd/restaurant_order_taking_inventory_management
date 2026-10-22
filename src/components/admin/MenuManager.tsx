"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Gift, Pencil, Plus, Trash2, UtensilsCrossed, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Modal from "@/components/ui/Modal";
import { Card, Chip, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { currency } from "@/lib/format";
import type { Category, Deal, MenuItem } from "@/lib/types";
import { useServerAction } from "@/lib/useServerAction";
import {
  createDealAction,
  createMenuItemAction,
  deleteDealAction,
  deleteMenuItemAction,
  setDealActiveAction,
  updateMenuItemAction,
} from "@/server/actions/admin";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/slices/uiSlice";

type View = "items" | "deals";

function PriceCell({ item, onSave, pending }: { item: MenuItem; onSave: (price: number) => void; pending: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.price));

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(item.price));
          setEditing(true);
        }}
        className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 font-bold tabular-nums text-fg transition-colors hover:bg-surface-3 hover:text-accent"
        aria-label={`Edit price of ${item.name}`}
      >
        {currency(item.price)}
        <Pencil className="size-3 text-fg-subtle group-hover:text-accent" aria-hidden />
      </button>
    );
  }

  const commit = () => {
    const price = Number(value);
    if (Number.isFinite(price) && price > 0) onSave(price);
    setEditing(false);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="number"
        min={0.01}
        step="0.01"
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setEditing(false);
        }}
        className="w-24 py-1.5 text-right text-xs"
        aria-label="New price"
      />
      <button
        type="button"
        onClick={commit}
        disabled={pending}
        aria-label="Save price"
        className="grid size-8 cursor-pointer place-items-center rounded-lg bg-accent text-accent-fg transition-transform active:scale-90"
      >
        <Check className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Cancel"
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-surface-3"
      >
        <X className="size-4" aria-hidden />
      </button>
    </span>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on ? "border-accent bg-accent" : "border-line-strong bg-surface-3",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4.5 rounded-full bg-white shadow-card transition-all duration-150",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

const blankItem = {
  name: "",
  description: "",
  price: "",
  categoryId: "starters",
  icon: "",
  prepMinutes: "10",
  available: true,
  tags: "",
  addOns: "",
};

function AddItemModal({ categories, onClose, onDone }: { categories: Category[]; onClose: () => void; onDone: () => void }) {
  const { call, pending } = useServerAction();
  const [form, setForm] = useState(blankItem);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof blankItem>(key: K, value: (typeof blankItem)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setError(null);
    const result = await call(() =>
      createMenuItemAction({
        name: form.name,
        description: form.description,
        price: Number(form.price),
        categoryId: form.categoryId,
        icon: form.icon,
        prepMinutes: Number(form.prepMinutes) || 0,
        available: form.available,
        tags: form.tags,
        addOns: form.addOns,
      }),
    );
    if (!result.ok) return setError(result.error);
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Add menu item"
      subtitle="New items appear on the order screen straight away."
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
            <Button onClick={submit} disabled={pending || !form.name.trim() || !form.price}>
              {pending ? "Saving…" : "Add item"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <Input value={form.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Peri Peri Wings" autoFocus />
        </Field>
        <Field label="Category" required>
          <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Price" required>
          <Input type="number" min={0.01} step="0.01" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Prep time (minutes)">
          <Input type="number" min={1} max={180} value={form.prepMinutes} onChange={(e) => set("prepMinutes", e.target.value)} />
        </Field>
        <Field label="Icon (emoji)" hint="Optional — defaults to the category icon">
          <Input value={form.icon} maxLength={8} onChange={(e) => set("icon", e.target.value)} placeholder="🍗" />
        </Field>
        <Field label="Tags" hint="Comma separated, e.g. Spicy, Popular">
          <Input value={form.tags} maxLength={80} onChange={(e) => set("tags", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <Input value={form.description} maxLength={160} onChange={(e) => set("description", e.target.value)} placeholder="One line the cashier can read out" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Add-ons" hint="Optional — one per line as “Name | price”, e.g. Extra cheese | 1.50">
            <Textarea rows={3} maxLength={600} value={form.addOns} onChange={(e) => set("addOns", e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-fg sm:col-span-2">
          <input type="checkbox" className="size-4 accent-accent" checked={form.available} onChange={(e) => set("available", e.target.checked)} />
          Available to order now
        </label>
      </div>
    </Modal>
  );
}

function AddDealModal({ items, onClose, onDone }: { items: MenuItem[]; onClose: () => void; onDone: () => void }) {
  const { call, pending } = useServerAction();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [parts, setParts] = useState<{ itemId: string; quantity: number }[]>([]);
  const [pick, setPick] = useState(items[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const worth = useMemo(
    () => parts.reduce((sum, part) => sum + (items.find((item) => item.id === part.itemId)?.price ?? 0) * part.quantity, 0),
    [parts, items],
  );

  const add = () => {
    if (!pick) return;
    setParts((current) => {
      const existing = current.find((part) => part.itemId === pick);
      return existing
        ? current.map((part) => (part.itemId === pick ? { ...part, quantity: Math.min(20, part.quantity + 1) } : part))
        : [...current, { itemId: pick, quantity: 1 }];
    });
  };

  const submit = async () => {
    setError(null);
    const result = await call(() => createDealAction({ name, description, price: Number(price), items: parts }));
    if (!result.ok) return setError(result.error);
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Create deal"
      subtitle="A bundle of menu items sold together at one price."
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
            <Button onClick={submit} disabled={pending || !name.trim() || !price || parts.length === 0}>
              {pending ? "Saving…" : "Create deal"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Deal name" required>
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lunch Box" autoFocus />
        </Field>
        <Field label="Deal price" required hint={worth > 0 ? `Items are worth ${currency(worth)} separately` : undefined}>
          <Input type="number" min={0.01} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" hint="Optional — otherwise the included items are listed">
            <Input value={description} maxLength={160} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Included items *</p>
          <div className="flex gap-2">
            <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Item to add">
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {currency(item.price)}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={add}>
              <Plus className="size-4" aria-hidden />
              Add
            </Button>
          </div>

          {parts.length > 0 ? (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {parts.map((part) => {
                const item = items.find((entry) => entry.id === part.itemId);
                return (
                  <li key={part.itemId} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span aria-hidden>{item?.icon}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-fg">{item?.name}</span>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={part.quantity}
                      onChange={(e) =>
                        setParts((current) =>
                          current.map((entry) =>
                            entry.itemId === part.itemId ? { ...entry, quantity: Math.min(20, Math.max(1, Number(e.target.value) || 1)) } : entry,
                          ),
                        )
                      }
                      className="w-16 py-1.5 text-center text-xs"
                      aria-label={`Quantity of ${item?.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => setParts((current) => current.filter((entry) => entry.itemId !== part.itemId))}
                      aria-label={`Remove ${item?.name}`}
                      className="grid size-8 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-fg-subtle">Pick items above and press Add.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function MenuManager({
  items,
  deals,
  categories,
}: {
  items: MenuItem[];
  deals: Deal[];
  categories: Category[];
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { call, pending } = useServerAction();
  const [view, setView] = useState<View>("items");
  const [category, setCategory] = useState("all");
  const [adding, setAdding] = useState<"item" | "deal" | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "item" | "deal"; id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryName = (id: string) => categories.find((entry) => entry.id === id)?.name ?? id;
  const visible = category === "all" ? items : items.filter((item) => item.categoryId === category);

  const toast = (message: string, tone?: "danger") => dispatch(showToast({ message, tone }));
  const refreshed = (message: string) => {
    toast(message);
    router.refresh();
  };

  const setPrice = async (item: MenuItem, price: number) => {
    const result = await call(() => updateMenuItemAction({ id: item.id, price }));
    if (result.ok) refreshed(`${item.name} is now ${currency(price)}`);
    else toast(result.error, "danger");
  };

  const setAvailable = async (item: MenuItem, available: boolean) => {
    const result = await call(() => updateMenuItemAction({ id: item.id, available }));
    if (result.ok) refreshed(`${item.name} ${available ? "is available" : "marked sold out"}`);
    else toast(result.error, "danger");
  };

  const setDealActive = async (deal: Deal, active: boolean) => {
    const result = await call(() => setDealActiveAction(deal.id, active));
    if (result.ok) refreshed(`${deal.name} ${active ? "is live" : "paused"}`);
    else toast(result.error, "danger");
  };

  const remove = async () => {
    if (!confirm) return;
    const result = await call(() => (confirm.kind === "item" ? deleteMenuItemAction(confirm.id) : deleteDealAction(confirm.id)));
    if (!result.ok) return setError(result.error);
    setConfirm(null);
    setError(null);
    refreshed(`${confirm.name} deleted`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Menu &amp; deals</h2>
          <p className="text-xs text-fg-muted">
            Add items, change prices, mark things sold out and bundle deals. Changes reach every register at once.
          </p>
        </div>
        <Button onClick={() => setAdding(view === "items" ? "item" : "deal")}>
          <Plus className="size-4" aria-hidden />
          {view === "items" ? "Add menu item" : "Create deal"}
        </Button>
      </div>

      <SegmentedControl
        options={[
          { value: "items" as View, label: `Menu items (${items.length})`, icon: UtensilsCrossed },
          { value: "deals" as View, label: `Deals (${deals.length})`, icon: Gift },
        ]}
        value={view}
        onChange={setView}
        size="sm"
        equalWidth={false}
      />

      {view === "items" ? (
        <>
          <div className="scroll-slim -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Chip active={category === "all"} onClick={() => setCategory("all")}>
              All
            </Chip>
            {categories.map((entry) => (
              <Chip key={entry.id} active={category === entry.id} onClick={() => setCategory(entry.id)}>
                {entry.name}
              </Chip>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="Nothing in this category" description="Add a menu item to see it here." />
          ) : (
            <Card className="overflow-hidden">
              <div className="scroll-slim overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-fg-muted">
                    <tr>
                      <th className="px-5 py-3 font-bold">Item</th>
                      <th className="px-5 py-3 font-bold">Category</th>
                      <th className="px-5 py-3 font-bold">Price</th>
                      <th className="px-5 py-3 font-bold">Available</th>
                      <th className="px-5 py-3 text-right font-bold">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visible.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-surface-2">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-base" aria-hidden>
                              {item.icon}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-fg">{item.name}</p>
                              <p className="truncate text-[11px] text-fg-muted">
                                {item.optionGroups.length > 0 ? `${item.optionGroups.length} option group(s)` : item.description}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-fg-muted">{categoryName(item.categoryId)}</td>
                        <td className="px-5 py-3">
                          <PriceCell item={item} pending={pending} onSave={(price) => void setPrice(item, price)} />
                        </td>
                        <td className="px-5 py-3">
                          <Toggle on={item.available} disabled={pending} label={`${item.name} available`} onChange={(next) => void setAvailable(item, next)} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setConfirm({ kind: "item", id: item.id, name: item.name });
                            }}
                            aria-label={`Delete ${item.name}`}
                            className="inline-grid size-9 cursor-pointer place-items-center rounded-lg text-fg-muted transition-all duration-150 hover:bg-danger-soft hover:text-danger active:scale-90"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No deals yet"
          description="Bundle a few items at one price and it shows up under Deals on the order screen."
          action={<Button onClick={() => setAdding("deal")}>Create deal</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {deals.map((deal) => (
            <Card key={deal.id} className={cn("p-5", !deal.active && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-base font-bold text-fg">
                    <span aria-hidden>🎁</span>
                    <span className="truncate">{deal.name}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-fg-muted">{deal.description || "Bundle"}</p>
                </div>
                <span className="text-lg font-bold tabular-nums text-accent">{currency(deal.price)}</span>
              </div>

              <ul className="mt-3 space-y-1 text-xs text-fg-muted">
                {deal.items.map((part) => {
                  const item = items.find((entry) => entry.id === part.itemId);
                  return (
                    <li key={part.itemId}>
                      <span className="font-bold text-fg">{part.quantity}×</span> {item?.name ?? "Removed item"}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-dashed border-line-strong pt-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-fg-muted">
                  <Toggle on={deal.active} disabled={pending} label={`${deal.name} active`} onChange={(next) => void setDealActive(deal, next)} />
                  {deal.active ? "Live on the order screen" : "Paused"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConfirm({ kind: "deal", id: deal.id, name: deal.name });
                  }}
                  aria-label={`Delete ${deal.name}`}
                  className="grid size-9 cursor-pointer place-items-center rounded-lg text-fg-muted transition-all duration-150 hover:bg-danger-soft hover:text-danger active:scale-90"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {adding === "item" ? (
        <AddItemModal
          categories={categories}
          onClose={() => setAdding(null)}
          onDone={() => {
            setAdding(null);
            refreshed("Menu item added");
          }}
        />
      ) : null}
      {adding === "deal" ? (
        <AddDealModal
          items={items}
          onClose={() => setAdding(null)}
          onDone={() => {
            setAdding(null);
            refreshed("Deal created");
          }}
        />
      ) : null}
      {confirm ? (
        <ConfirmModal
          title={`Delete ${confirm.name}?`}
          message={
            confirm.kind === "item"
              ? "It disappears from the order screen. Past orders keep their record of it."
              : "The deal disappears from the order screen. Past orders keep their record of it."
          }
          confirmLabel="Delete"
          pending={pending}
          error={error}
          onConfirm={() => void remove()}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
