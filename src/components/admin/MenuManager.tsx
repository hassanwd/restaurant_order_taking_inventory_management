"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Gift, Loader2, Pencil, Plus, Trash2, UtensilsCrossed, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Modal from "@/components/ui/Modal";
import { Card, Chip, EmptyState, Field, Input, ItemImage, Select, Textarea } from "@/components/ui/primitives";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { currency } from "@/lib/format";
import { prepareImage } from "@/lib/image";
import type { Category, Deal, MenuItem, OptionGroup } from "@/lib/types";
import { useServerAction } from "@/lib/useServerAction";
import {
  createDealAction,
  createMenuItemAction,
  deleteDealAction,
  deleteMenuItemAction,
  setDealActiveAction,
  updateDealAction,
  updateDealImageAction,
  updateMenuItemAction,
} from "@/server/actions/admin";
import { uploadImageAction, type UploadPurpose } from "@/server/actions/uploads";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/slices/uiSlice";

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

type View = "items" | "deals";

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

/**
 * A photo picker that uploads immediately on choosing a file — no URL to type anywhere. Click (or
 * tap) the thumbnail to choose a photo; an × badge clears it. Used both as a bigger "add a photo"
 * control in the create forms and as a small inline-edit thumbnail in the item rows and deal cards.
 */
function ImageCell({
  src,
  alt,
  size,
  purpose,
  icon,
  disabled,
  onChange,
}: {
  src: string | null;
  alt: string;
  size: string;
  purpose: UploadPurpose;
  icon?: typeof UtensilsCrossed;
  disabled?: boolean;
  /** Called with the new path once the upload finishes, or `""` when the × badge clears it. */
  onChange: (image: string) => void;
}) {
  const { call, pending } = useServerAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    const prepared = await prepareImage(file);
    const formData = new FormData();
    formData.append("file", prepared);
    const result = await call(() => uploadImageAction(purpose, formData));
    if (result.ok) onChange(result.path);
    else setError(result.error);
  };

  const busy = pending || disabled;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={src ? `Replace photo for ${alt}` : `Upload a photo for ${alt}`}
          className={cn("group relative block shrink-0 cursor-pointer overflow-hidden rounded-lg disabled:cursor-not-allowed", size)}
        >
          <ItemImage src={src} alt={alt} icon={icon} className={cn(size, "rounded-lg")} />
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-lg bg-ink-900/55 text-white transition-opacity",
              pending ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Pencil className="size-3.5" aria-hidden />}
          </span>
        </button>
        {src && !busy ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Remove photo for ${alt}`}
            className="absolute -right-1.5 -top-1.5 grid size-5 cursor-pointer place-items-center rounded-full border border-line bg-surface text-fg-muted shadow-card transition-colors hover:border-danger hover:text-danger"
          >
            <X className="size-3" aria-hidden />
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="hidden"
          onChange={(e) => {
            void pickFile(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error ? <p className="max-w-32 text-[10px] font-semibold leading-snug text-danger">{error}</p> : null}
    </div>
  );
}

interface DraftChoice {
  name: string;
  price: string;
}

/**
 * A UI-only distinction the server doesn't have: both "any" and "upto" save as the same
 * `type: "multi"` — "any" always clears `maxSelect` (every choice is pickable, no cap), "upto" is
 * the only mode that shows the "Up to" field and carries a limit.
 */
type DraftMode = "single" | "any" | "upto";

interface DraftGroup {
  name: string;
  mode: DraftMode;
  required: boolean;
  /** `upto` mode only: text state for the "max selections" field. */
  maxSelect: string;
  choices: DraftChoice[];
}

const MAX_OPTION_GROUPS = 8;
const MAX_CHOICES_PER_GROUP = 12;

const emptyGroup = (): DraftGroup => ({
  name: "",
  mode: "single",
  required: false,
  maxSelect: "",
  choices: [{ name: "", price: "" }],
});

/** Drops anything left blank, so a half-filled group or choice is simply ignored rather than rejected. */
function serializeGroups(groups: DraftGroup[]) {
  return groups
    .map((group) => {
      const choices = group.choices
        .map((choice) => ({ name: choice.name.trim(), price: Number(choice.price) || 0 }))
        .filter((choice) => choice.name);
      const maxSelect = Number(group.maxSelect);
      return {
        name: group.name.trim(),
        type: group.mode === "single" ? ("single" as const) : ("multi" as const),
        required: group.required,
        // Never let a stale limit outlive the choices it was set against — it can only shrink.
        maxSelect: group.mode === "upto" && maxSelect > 0 ? Math.min(choices.length, Math.round(maxSelect)) || null : null,
        choices,
      };
    })
    .filter((group) => group.name && group.choices.length > 0);
}

/**
 * A repeatable builder for a menu item's or deal's customization groups — e.g. "Dip Sauce, pick 1
 * of 4" or "Drink, pick 1" with a single included choice. Shared by the item and deal create forms;
 * `serializeGroups` turns its draft state into what the server actions expect. Used for two
 * separate sections: free "Options" (`showPrice` false, every choice costs nothing extra) and
 * "Add-ons" (`showPrice` true, each choice can carry its own surcharge; `allowRequired` false — an
 * extra that costs more is always an upsell, never something the guest must buy).
 */
function OptionGroupsEditor({
  groups,
  onChange,
  showPrice = true,
  allowRequired = true,
}: {
  groups: DraftGroup[];
  onChange: (next: DraftGroup[]) => void;
  showPrice?: boolean;
  allowRequired?: boolean;
}) {
  const updateGroup = (index: number, patch: Partial<DraftGroup>) =>
    onChange(groups.map((group, i) => (i === index ? { ...group, ...patch } : group)));
  const removeGroup = (index: number) => onChange(groups.filter((_, i) => i !== index));
  const addChoice = (groupIndex: number) =>
    updateGroup(groupIndex, { choices: [...groups[groupIndex].choices, { name: "", price: "" }] });
  const updateChoice = (groupIndex: number, choiceIndex: number, patch: Partial<DraftChoice>) =>
    updateGroup(groupIndex, {
      choices: groups[groupIndex].choices.map((choice, i) => (i === choiceIndex ? { ...choice, ...patch } : choice)),
    });
  const removeChoice = (groupIndex: number, choiceIndex: number) => {
    const choices = groups[groupIndex].choices.filter((_, i) => i !== choiceIndex);
    const maxSelect = groups[groupIndex].maxSelect;
    // The limit can never exceed how many choices are actually left to pick from.
    const clampedMax = maxSelect && Number(maxSelect) > choices.length ? String(choices.length) : maxSelect;
    updateGroup(groupIndex, { choices, maxSelect: clampedMax });
  };

  return (
    <div className="space-y-3">
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={group.name}
              maxLength={40}
              placeholder="Group name, e.g. Dip Sauce"
              onChange={(e) => updateGroup(groupIndex, { name: e.target.value })}
              className="min-w-40 flex-1"
            />
            <Select
              value={group.mode}
              onChange={(e) => {
                const mode = e.target.value as DraftMode;
                // Switching away from "upto" drops the limit — "any" has none, "single" doesn't use it.
                updateGroup(groupIndex, { mode, maxSelect: mode === "upto" ? group.maxSelect : "" });
              }}
              className="w-auto"
              aria-label="Selection type"
            >
              <option value="single">Pick one</option>
              <option value="any">Pick any</option>
              <option value="upto">Pick multiple</option>
            </Select>
            {group.mode === "upto" ? (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                Up to
                <Input
                  type="number"
                  min={1}
                  max={group.choices.length}
                  step={1}
                  placeholder="e.g. 3"
                  value={group.maxSelect}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return updateGroup(groupIndex, { maxSelect: "" });
                    const clamped = Math.min(group.choices.length, Math.max(1, Math.round(Number(raw)) || 1));
                    updateGroup(groupIndex, { maxSelect: String(clamped) });
                  }}
                  className="w-16 py-1 text-center text-xs"
                  aria-label="Maximum number of choices"
                />
              </label>
            ) : null}
            {allowRequired ? (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={group.required}
                  onChange={(e) => updateGroup(groupIndex, { required: e.target.checked })}
                />
                Required
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => removeGroup(groupIndex)}
              aria-label={`Remove group ${group.name || groupIndex + 1}`}
              className="ml-auto grid size-8 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 px-0.5">
              <span className="flex-1 text-[10px] font-bold uppercase tracking-wide text-fg-subtle">Choice name</span>
              {showPrice ? (
                <span className="w-20 text-right text-[10px] font-bold uppercase tracking-wide text-fg-subtle">Price</span>
              ) : null}
              <span className="w-8 shrink-0" aria-hidden />
            </div>
            {group.choices.map((choice, choiceIndex) => (
              <div key={choiceIndex} className="flex items-center gap-1.5">
                <Input
                  value={choice.name}
                  maxLength={40}
                  placeholder="e.g. Ketchup"
                  aria-label="Choice name"
                  onChange={(e) => updateChoice(groupIndex, choiceIndex, { name: e.target.value })}
                  className="flex-1 py-1.5 text-xs"
                />
                {showPrice ? (
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={choice.price}
                    placeholder="0.00"
                    onChange={(e) => updateChoice(groupIndex, choiceIndex, { price: e.target.value })}
                    className="w-20 py-1.5 text-right text-xs"
                    aria-label={`Price for ${choice.name || "this choice"}`}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => removeChoice(groupIndex, choiceIndex)}
                  disabled={group.choices.length <= 1}
                  aria-label="Remove choice"
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addChoice(groupIndex)}
              disabled={group.choices.length >= MAX_CHOICES_PER_GROUP}
              className="text-xs font-bold text-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add choice
            </button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...groups, emptyGroup()])}
        disabled={groups.length >= MAX_OPTION_GROUPS}
      >
        <Plus className="size-4" aria-hidden />
        Add option group
      </Button>
    </div>
  );
}

const blankItem = {
  name: "",
  description: "",
  price: "",
  categoryId: "starters",
  image: "",
  ingredients: "",
  prepMinutes: "10",
  available: true,
};

const itemToForm = (item: MenuItem): typeof blankItem => ({
  name: item.name,
  description: item.description,
  price: String(item.price),
  categoryId: item.categoryId,
  image: item.image ?? "",
  ingredients: item.ingredients ?? "",
  prepMinutes: String(item.prepMinutes),
  available: item.available,
});

function groupToDraft(group: OptionGroup): DraftGroup {
  return {
    name: group.name,
    mode: group.type === "single" ? "single" : group.maxSelect ? "upto" : "any",
    required: group.required,
    maxSelect: group.maxSelect ? String(group.maxSelect) : "",
    choices: group.choices.map((choice) => ({ name: choice.name, price: String(choice.price) })),
  };
}

/**
 * Re-opening an existing item/deal for editing: a stored group carries no record of which section
 * it was authored under, so it's routed by whether it actually charges for anything — any group
 * with a priced choice reopens under Add-ons (the only editor that can show that price), everything
 * else reopens under the free Options editor.
 */
function splitGroupsForEdit(groups: OptionGroup[]): { options: DraftGroup[]; addOns: DraftGroup[] } {
  const options: DraftGroup[] = [];
  const addOns: DraftGroup[] = [];
  for (const group of groups) {
    if (group.choices.some((choice) => choice.price > 0)) {
      // The Add-ons editor has no "Required" control — a priced extra is never mandatory, even if
      // an older record (saved before this rule) had it set.
      addOns.push({ ...groupToDraft(group), required: false });
    } else {
      options.push(groupToDraft(group));
    }
  }
  return { options, addOns };
}

/** Also used to edit an existing item — pass `item` and it pre-fills and saves via `updateMenuItemAction`. */
function ItemFormModal({
  categories,
  item,
  onClose,
  onDone,
}: {
  categories: Category[];
  item?: MenuItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const { call, pending } = useServerAction();
  const [form, setForm] = useState(() => (item ? itemToForm(item) : blankItem));
  const split = useMemo(() => (item ? splitGroupsForEdit(item.optionGroups) : { options: [], addOns: [] }), [item]);
  const [groups, setGroups] = useState<DraftGroup[]>(split.options);
  const [addOns, setAddOns] = useState<DraftGroup[]>(split.addOns);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof blankItem>(key: K, value: (typeof blankItem)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setError(null);
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      categoryId: form.categoryId,
      image: form.image,
      ingredients: form.ingredients,
      prepMinutes: Number(form.prepMinutes) || 0,
      available: form.available,
      optionGroups: [...serializeGroups(groups), ...serializeGroups(addOns)],
    };
    // Editing never touches tags (there's no field for them here, and they're otherwise only
    // used for menu search) — a new item simply starts with none.
    const result = await call(() =>
      item ? updateMenuItemAction({ id: item.id, ...payload }) : createMenuItemAction({ ...payload, tags: "" }),
    );
    if (!result.ok) return setError(result.error);
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={item ? `Edit ${item.name}` : "Add menu item"}
      subtitle={item ? "Changes reach the order screen straight away." : "New items appear on the order screen straight away."}
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
              {pending ? "Saving…" : item ? "Save changes" : "Add item"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <ImageCell
            src={form.image || null}
            alt={form.name || "New item"}
            size="size-14"
            purpose="item"
            onChange={(image) => set("image", image)}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">Photo</p>
            <p className="mt-0.5 text-[11px] text-fg-subtle">Optional — PNG, JPEG, WEBP or GIF, up to 5MB</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-line bg-surface-2 p-3">
          <span className="text-sm font-semibold text-fg">Is this in stock?</span>
          <Toggle on={form.available} label="In stock" onChange={(next) => set("available", next)} />
        </div>
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
        <div className="sm:col-span-2">
          <Field label="Description" hint="Shown wrapped on the order screen, so a line break here won't be kept">
            <Textarea rows={2} maxLength={160} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="A short blurb the cashier can read out" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Ingredients" hint="Optional — shown to whoever is taking the order">
            <Textarea
              rows={2}
              maxLength={400}
              value={form.ingredients}
              onChange={(e) => set("ingredients", e.target.value)}
              placeholder="e.g. Brioche bun, double patty, cheddar, pickles, burger sauce"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
            Options <span className="font-medium normal-case text-fg-subtle">— optional, free choices, e.g. “Doneness, pick 1 of 4”</span>
          </p>
          <OptionGroupsEditor groups={groups} onChange={setGroups} showPrice={false} />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
            Add-ons <span className="font-medium normal-case text-fg-subtle">— optional, each choice can cost extra, e.g. “Extra cheese +1.50”</span>
          </p>
          <OptionGroupsEditor groups={addOns} onChange={setAddOns} allowRequired={false} />
        </div>
      </div>
    </Modal>
  );
}

/** Also used to edit an existing deal — pass `deal` and it pre-fills and saves via `updateDealAction`. */
function DealFormModal({
  items,
  deal,
  onClose,
  onDone,
}: {
  items: MenuItem[];
  deal?: Deal;
  onClose: () => void;
  onDone: () => void;
}) {
  const { call, pending } = useServerAction();
  const [name, setName] = useState(deal?.name ?? "");
  const [description, setDescription] = useState(deal?.description ?? "");
  const [price, setPrice] = useState(deal ? String(deal.price) : "");
  const [parts, setParts] = useState<{ itemId: string; quantity: number }[]>(() => deal?.items.map((part) => ({ ...part })) ?? []);
  const [pick, setPick] = useState(items[0]?.id ?? "");
  const [image, setImage] = useState(deal?.image ?? "");
  const [ingredients, setIngredients] = useState(deal?.ingredients ?? "");
  const dealSplit = useMemo(() => (deal ? splitGroupsForEdit(deal.optionGroups) : { options: [], addOns: [] }), [deal]);
  const [groups, setGroups] = useState<DraftGroup[]>(dealSplit.options);
  const [addOns, setAddOns] = useState<DraftGroup[]>(dealSplit.addOns);
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
    const payload = {
      name,
      description,
      price: Number(price),
      image,
      ingredients,
      items: parts,
      optionGroups: [...serializeGroups(groups), ...serializeGroups(addOns)],
    };
    const result = await call(() => (deal ? updateDealAction({ id: deal.id, ...payload }) : createDealAction(payload)));
    if (!result.ok) return setError(result.error);
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={deal ? `Edit ${deal.name}` : "Create deal"}
      subtitle={deal ? "Changes reach the order screen straight away." : "A bundle of menu items sold together at one price."}
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
              {pending ? "Saving…" : deal ? "Save changes" : "Create deal"}
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
            <Textarea rows={2} maxLength={160} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Photo" hint="Optional — PNG, JPEG, WEBP or GIF, up to 5MB">
            <ImageCell
              src={image || null}
              alt={name || "New deal"}
              size="size-20"
              purpose="deal"
              icon={Gift}
              onChange={setImage}
            />
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
                    <ItemImage src={item?.image} alt={item?.name ?? ""} className="size-7 shrink-0 rounded-md" />
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

        <div className="sm:col-span-2">
          <Field label="Ingredients" hint="Optional — shown to whoever is taking the order">
            <Textarea
              rows={2}
              maxLength={400}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="e.g. 2× Zinger Burger, 2 Pcs Drumstick, Fries"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
            Options <span className="font-medium normal-case text-fg-subtle">— optional, free choices, e.g. “Dip Sauce, pick 1 of 4”</span>
          </p>
          <OptionGroupsEditor groups={groups} onChange={setGroups} showPrice={false} />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
            Add-ons <span className="font-medium normal-case text-fg-subtle">— optional, each choice can cost extra, e.g. “Extra cheese +1.50”</span>
          </p>
          <OptionGroupsEditor groups={addOns} onChange={setAddOns} allowRequired={false} />
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
  const [itemModal, setItemModal] = useState<"add" | MenuItem | null>(null);
  const [dealModal, setDealModal] = useState<"add" | Deal | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "item" | "deal"; id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryName = (id: string) => categories.find((entry) => entry.id === id)?.name ?? id;
  const visible = category === "all" ? items : items.filter((item) => item.categoryId === category);

  const toast = (message: string, tone?: "danger") => dispatch(showToast({ message, tone }));
  const refreshed = (message: string) => {
    toast(message);
    router.refresh();
  };

  const setAvailable = async (item: MenuItem, available: boolean) => {
    const result = await call(() => updateMenuItemAction({ id: item.id, available }));
    if (result.ok) refreshed(`${item.name} ${available ? "is available" : "marked sold out"}`);
    else toast(result.error, "danger");
  };

  const setItemImage = async (item: MenuItem, image: string) => {
    const result = await call(() => updateMenuItemAction({ id: item.id, image }));
    if (result.ok) refreshed(`${item.name} image ${image ? "updated" : "cleared"}`);
    else toast(result.error, "danger");
  };

  const setDealImage = async (deal: Deal, image: string) => {
    const result = await call(() => updateDealImageAction({ id: deal.id, image }));
    if (result.ok) refreshed(`${deal.name} image ${image ? "updated" : "cleared"}`);
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
        <Button onClick={() => (view === "items" ? setItemModal("add") : setDealModal("add"))}>
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
                      <th className="px-5 py-3 font-bold">Stock</th>
                      <th className="px-5 py-3 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visible.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-surface-2">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <ImageCell
                              src={item.image}
                              alt={item.name}
                              size="size-9"
                              purpose="item"
                              disabled={pending}
                              onChange={(image) => void setItemImage(item, image)}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-fg">{item.name}</p>
                              <p className="truncate text-[11px] text-fg-muted">
                                {item.optionGroups.length > 0 ? `${item.optionGroups.length} option group(s)` : item.description}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-fg-muted">{categoryName(item.categoryId)}</td>
                        <td className="px-5 py-3 font-bold tabular-nums text-fg">{currency(item.price)}</td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => void setAvailable(item, !item.available)}
                            disabled={pending}
                            aria-pressed={item.available}
                            aria-label={`${item.name} ${item.available ? "in stock" : "out of stock"} — click to change`}
                            className={cn(
                              "cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                              item.available
                                ? "bg-accent-soft text-accent hover:bg-accent/20"
                                : "bg-danger-soft text-danger hover:bg-danger/20",
                            )}
                          >
                            {item.available ? "In stock" : "Out of stock"}
                          </button>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setItemModal(item)}
                              aria-label={`Edit ${item.name}`}
                              className="inline-grid size-9 cursor-pointer place-items-center rounded-lg text-fg-muted transition-all duration-150 hover:bg-surface-3 hover:text-accent active:scale-90"
                            >
                              <Pencil className="size-4" aria-hidden />
                            </button>
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
                          </div>
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
          action={<Button onClick={() => setDealModal("add")}>Create deal</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {deals.map((deal) => (
            <Card key={deal.id} className={cn("p-5", !deal.active && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ImageCell
                    src={deal.image}
                    alt={deal.name}
                    size="size-11"
                    purpose="deal"
                    icon={Gift}
                    disabled={pending}
                    onChange={(image) => void setDealImage(deal, image)}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-fg">{deal.name}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">{deal.description || "Bundle"}</p>
                  </div>
                </div>
                <span className="shrink-0 text-lg font-bold tabular-nums text-accent">{currency(deal.price)}</span>
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
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDealModal(deal)}
                    aria-label={`Edit ${deal.name}`}
                    className="grid size-9 cursor-pointer place-items-center rounded-lg text-fg-muted transition-all duration-150 hover:bg-surface-3 hover:text-accent active:scale-90"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
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
              </div>
            </Card>
          ))}
        </div>
      )}

      {itemModal ? (
        <ItemFormModal
          categories={categories}
          item={itemModal === "add" ? undefined : itemModal}
          onClose={() => setItemModal(null)}
          onDone={() => {
            const message = itemModal === "add" ? "Menu item added" : "Menu item updated";
            setItemModal(null);
            refreshed(message);
          }}
        />
      ) : null}
      {dealModal ? (
        <DealFormModal
          items={items}
          deal={dealModal === "add" ? undefined : dealModal}
          onClose={() => setDealModal(null)}
          onDone={() => {
            const message = dealModal === "add" ? "Deal created" : "Deal updated";
            setDealModal(null);
            refreshed(message);
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
