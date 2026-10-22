"use client";

import type { SegmentOption } from "@/components/ui/SegmentedControl";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { Card, Field, Select } from "@/components/ui/primitives";
import { ORDER_TYPE_LABEL } from "@/lib/format";
import { ORDER_TYPE_ICONS } from "@/lib/icons";
import type { DiningTable, OrderType } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setOrderType, setTable } from "@/store/slices/cartSlice";

const ORDER_TYPES: OrderType[] = ["dine-in", "takeaway", "parcel"];
const ORDER_TYPE_OPTIONS: SegmentOption<OrderType>[] = ORDER_TYPES.map((type) => ({
  value: type,
  label: ORDER_TYPE_LABEL[type],
  icon: ORDER_TYPE_ICONS[type],
}));

/** The dining room offers Table 1 to Table 5. */
export const ORDERABLE_TABLE = /^T[1-5]$/;

/**
 * Order type and, for dine-in, the table. Customer details are collected at
 * checkout, so this stays a one-glance control that never gets in the way of
 * tapping dishes.
 */
export default function OrderSetup({ tables }: { tables: DiningTable[] }) {
  const dispatch = useAppDispatch();
  const { orderType, tableId } = useAppSelector((state) => state.cart);

  return (
    <Card className="p-4">
      <SegmentedControl
        options={ORDER_TYPE_OPTIONS}
        value={orderType}
        onChange={(type) => dispatch(setOrderType(type))}
      />

      {orderType === "dine-in" ? (
        <div className="mt-4 max-w-sm">
          <Field label="Table" required>
            <Select
              value={tableId ?? ""}
              onChange={(event) => dispatch(setTable(event.target.value || null))}
            >
              <option value="">Select a table…</option>
              {tables
                .filter((table) => ORDERABLE_TABLE.test(table.id))
                .map((table) => (
                  <option key={table.id} value={table.id} disabled={table.status === "occupied"}>
                    {table.name}
                    {table.status === "occupied" ? " (occupied)" : ""}
                    {table.status === "reserved" ? " (reserved)" : ""}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
      ) : null}
    </Card>
  );
}
