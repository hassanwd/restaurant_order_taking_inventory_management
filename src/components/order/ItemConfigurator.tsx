"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { currency, round2 } from "@/lib/format";
import type { MenuItem, OptionGroup, SelectedOption } from "@/lib/types";
import { useAppDispatch } from "@/store/hooks";
import { addLine } from "@/store/slices/cartSlice";
import { closeItemConfigurator, showToast } from "@/store/slices/uiSlice";
import QuantityStepper from "./QuantityStepper";

/** Required single-choice groups start on their first option. */
function defaultSingles(item: MenuItem) {
  const picks: Record<string, string> = {};
  for (const group of item.optionGroups) {
    if (group.type === "single" && group.required && group.choices[0]) {
      picks[group.id] = group.choices[0].id;
    }
  }
  return picks;
}

/** Mounted with `key={item.id}`, so its state resets naturally per item. */
export default function ItemConfigurator({ item }: { item: MenuItem }) {
  const dispatch = useAppDispatch();
  const [singles, setSingles] = useState<Record<string, string>>(() => defaultSingles(item));
  const [multis, setMultis] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const selected = useMemo<SelectedOption[]>(() => {
    const result: SelectedOption[] = [];
    for (const group of item.optionGroups) {
      if (group.type === "single") {
        const choice = group.choices.find((entry) => entry.id === singles[group.id]);
        if (choice) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            choiceId: choice.id,
            choiceName: choice.name,
            price: choice.price,
          });
        }
      } else {
        for (const choiceId of multis[group.id] ?? []) {
          const choice = group.choices.find((entry) => entry.id === choiceId);
          if (choice) {
            result.push({
              groupId: group.id,
              groupName: group.name,
              choiceId: choice.id,
              choiceName: choice.name,
              price: choice.price,
            });
          }
        }
      }
    }
    return result;
  }, [item, singles, multis]);

  const unitPrice = round2(item.price + selected.reduce((sum, option) => sum + option.price, 0));
  // Mirrors the server's own check in buildLines. A required group — single or multi — needs a
  // pick; a required group with a "pick up to N" limit needs exactly N, not just one (since it can
  // never exceed N either, "at least N" and "exactly N" are the same thing here).
  const missing = item.optionGroups.filter((group) => {
    if (!group.required) return false;
    if (group.type === "single") return !singles[group.id];
    return (multis[group.id]?.length ?? 0) < (group.maxSelect ?? 1);
  });

  const close = () => dispatch(closeItemConfigurator());

  const submit = () => {
    if (missing.length > 0) return;
    dispatch(addLine({ item, quantity, options: selected, notes: notes.trim() }));
    dispatch(showToast({ message: `${quantity} × ${item.name} added` }));
    close();
  };

  const toggleMulti = (group: OptionGroup, choiceId: string) => {
    setMultis((current) => {
      const existing = current[group.id] ?? [];
      if (existing.includes(choiceId)) {
        return { ...current, [group.id]: existing.filter((entry) => entry !== choiceId) };
      }
      // Already at the cap — selecting another choice does nothing until one is unchecked.
      if (group.maxSelect && existing.length >= group.maxSelect) return current;
      return { ...current, [group.id]: [...existing, choiceId] };
    });
  };

  return (
    <Modal
      open
      onClose={close}
      title={item.name}
      subtitle={item.description}
      footer={
        <div className="flex items-center gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} />
          <Button
            onClick={submit}
            disabled={missing.length > 0}
            size="lg"
            className="flex-1 justify-between"
          >
            <span>Add to order</span>
            <span className="tabular-nums">{currency(unitPrice * quantity)}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {item.ingredients ? (
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Ingredients</p>
            <p className="text-sm text-fg-muted">{item.ingredients}</p>
          </div>
        ) : null}

        {item.optionGroups.map((group) => {
          const picked = multis[group.id] ?? [];
          const atLimit = group.type === "multi" && !!group.maxSelect && picked.length >= group.maxSelect;

          return (
            <fieldset key={group.id}>
              <legend className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                {group.name}
                {group.required ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent">
                    Required
                  </span>
                ) : (
                  <span className="text-[10px] font-medium normal-case text-fg-subtle">optional</span>
                )}
                {group.type === "multi" && group.maxSelect ? (
                  <span className="text-[10px] font-medium normal-case text-fg-subtle">
                    · pick {group.required ? "" : "up to "}
                    {group.maxSelect}
                  </span>
                ) : null}
              </legend>

              <div className="grid gap-2 sm:grid-cols-2">
                {group.choices.map((choice) => {
                  const checked = group.type === "single" ? singles[group.id] === choice.id : picked.includes(choice.id);
                  const disabled = group.type === "multi" && !checked && atLimit;

                  return (
                    <label
                      key={choice.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                        disabled
                          ? "cursor-not-allowed border-line bg-surface-2 text-fg-subtle opacity-50"
                          : "cursor-pointer",
                        !disabled && checked && "border-accent bg-accent-soft text-fg",
                        !disabled && !checked && "border-line bg-surface-2 text-fg-muted hover:border-accent/60",
                      )}
                    >
                      <input
                        type={group.type === "single" ? "radio" : "checkbox"}
                        name={group.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={() =>
                          group.type === "single"
                            ? setSingles((current) => ({ ...current, [group.id]: choice.id }))
                            : toggleMulti(group, choice.id)
                        }
                        className="size-4 accent-accent"
                      />
                      <span className="flex-1 font-semibold text-fg">{choice.name}</span>
                      {choice.price > 0 ? (
                        <span className="text-xs font-bold tabular-nums text-accent">
                          +{currency(choice.price)}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
            Kitchen note
          </p>
          <Textarea
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="e.g. no onions, allergy: nuts, serve last"
          />
        </div>
      </div>
    </Modal>
  );
}
