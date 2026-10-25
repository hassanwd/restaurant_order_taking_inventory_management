"use client";

import { useMemo } from "react";
import { ChevronRight, Clock, Plus, Search, SearchX, UtensilsCrossed } from "lucide-react";
import { Chip, EmptyState, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { currency } from "@/lib/format";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from "@/lib/icons";
import type { Category, MenuItem } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addLine } from "@/store/slices/cartSlice";
import {
  openItemConfigurator,
  setActiveCategory,
  setMenuSearch,
  showToast,
} from "@/store/slices/uiSlice";

/**
 * A horizontal browsing card: text (name, description, price) on the left, the product photo
 * floating uncropped on the right rather than cropped into a box — so an off-center or unusually
 * shaped photo never loses part of itself, and shows its own corners like a product cutout.
 */
function ItemCard({ item, count }: { item: MenuItem; count: number }) {
  const dispatch = useAppDispatch();
  const hasOptions = item.optionGroups.length > 0;

  const onSelect = () => {
    if (!item.available) return;
    if (hasOptions) {
      dispatch(openItemConfigurator(item.id));
      return;
    }
    dispatch(addLine({ item }));
    dispatch(showToast({ message: `${item.name} added` }));
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!item.available}
      className={cn(
        "group relative flex min-h-[9rem] cursor-pointer items-stretch gap-3 overflow-hidden rounded-2xl border bg-surface p-4 pr-32 text-left transition-all duration-150 sm:min-h-[10rem] sm:pr-40",
        item.available
          ? "border-line hover:-translate-y-0.5 hover:border-accent hover:shadow-pop active:translate-y-0 active:scale-[0.99]"
          : "cursor-not-allowed border-dashed border-line opacity-55",
      )}
    >
      {count > 0 ? (
        <span className="absolute right-2.5 top-2.5 z-10 grid min-w-6 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-fg shadow-card">
          {count}
        </span>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="line-clamp-2 text-sm font-bold text-fg">{item.name}</p>
        {/* Ingredients tell the order-taker what's actually in it; description is just a fallback
            for anything that hasn't had its ingredients filled in yet. */}
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-muted">
          {item.ingredients || item.description}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <span className="rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-bold tabular-nums text-white dark:bg-white dark:text-ink-900">
            {currency(item.price)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
            <Clock className="size-3" aria-hidden />
            {item.prepMinutes}m
          </span>
          {item.popular ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
              Popular
            </span>
          ) : null}
          {!item.available ? (
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
              Sold out
            </span>
          ) : null}
        </div>

        {hasOptions && item.available ? (
          <span className="mt-1 flex items-center text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
            Choose options
            <ChevronRight className="size-3" aria-hidden />
          </span>
        ) : null}
      </div>

      {/* The photo itself: object-contain, no background box, so it floats on the card like a
          product cutout instead of being cropped to fill a tile. */}
      <div className="pointer-events-none absolute inset-y-1 right-1 flex w-32 items-center justify-center sm:w-40">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL, fetched directly by the browser.
          <img
            src={item.image}
            alt=""
            className="size-full object-contain drop-shadow-md"
            loading="lazy"
          />
        ) : (
          <UtensilsCrossed className="size-11 text-fg-subtle" aria-hidden />
        )}
      </div>

      <span
        className={cn(
          "absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full text-accent-fg shadow-card transition-transform duration-150",
          item.available ? "bg-accent group-hover:scale-105" : "bg-fg-subtle",
        )}
      >
        <Plus className="size-5" aria-hidden />
      </span>
    </button>
  );
}

export default function MenuBrowser({
  categories,
  items,
}: {
  categories: Category[];
  items: MenuItem[];
}) {
  const dispatch = useAppDispatch();
  const activeCategory = useAppSelector((state) => state.ui.activeCategory);
  const search = useAppSelector((state) => state.ui.menuSearch);
  const lines = useAppSelector((state) => state.cart.lines);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) {
      map.set(line.itemId, (map.get(line.itemId) ?? 0) + line.quantity);
    }
    return map;
  }, [lines]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const inCategory = activeCategory === "all" || item.categoryId === activeCategory;
      if (!inCategory) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [items, activeCategory, search]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => dispatch(setMenuSearch(event.target.value))}
            placeholder="Search the menu — name, description or tag"
            className="pl-10"
            aria-label="Search menu"
          />
          {search ? (
            <button
              type="button"
              onClick={() => dispatch(setMenuSearch(""))}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-xs font-bold text-fg-subtle transition-transform duration-150 hover:text-accent active:scale-90"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="scroll-slim -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.id] ?? DEFAULT_CATEGORY_ICON;
            return (
              <Chip
                key={category.id}
                active={activeCategory === category.id}
                onClick={() => dispatch(setActiveCategory(category.id))}
              >
                <Icon className="size-3.5" aria-hidden />
                {category.name}
              </Chip>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nothing matches that search"
          description="Try another keyword, or pick a different category to browse the full menu."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} count={counts.get(item.id) ?? 0} />
          ))}
        </div>
      )}
    </section>
  );
}
