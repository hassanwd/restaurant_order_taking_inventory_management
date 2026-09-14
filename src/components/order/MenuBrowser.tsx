"use client";

import { useMemo } from "react";
import { ChevronRight, Clock, Search, SearchX } from "lucide-react";
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
        "group relative flex cursor-pointer flex-col gap-2 rounded-2xl border bg-surface p-3 text-left transition-all duration-150",
        item.available
          ? "border-line hover:-translate-y-0.5 hover:border-accent hover:shadow-pop active:translate-y-0 active:scale-[0.98]"
          : "cursor-not-allowed border-dashed border-line opacity-55",
      )}
    >
      {count > 0 ? (
        <span className="absolute right-2.5 top-2.5 z-10 grid min-w-6 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-fg shadow-card">
          {count}
        </span>
      ) : null}

      {/* The dish glyph stands in for a photo — kept as the menu's own emoji, not chrome. */}
      <div className="relative grid aspect-[4/3] place-items-center rounded-xl bg-surface-3 text-4xl">
        <span aria-hidden>{item.icon}</span>
        {item.popular ? (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-fg">
            Popular
          </span>
        ) : null}
        {!item.available ? (
          <span className="absolute inset-x-2 bottom-2 rounded-lg bg-ink-900/85 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white">
            Sold out
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-fg">{item.name}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-fg-muted">
          {item.description}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-sm font-bold tabular-nums text-accent">{currency(item.price)}</span>
        <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
          <Clock className="size-3" aria-hidden />
          {item.prepMinutes}m
        </span>
      </div>

      {hasOptions && item.available ? (
        <span className="flex items-center text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
          Choose options
          <ChevronRight className="size-3" aria-hidden />
        </span>
      ) : null}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} count={counts.get(item.id) ?? 0} />
          ))}
        </div>
      )}
    </section>
  );
}
