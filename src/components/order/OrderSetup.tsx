"use client";

import type { SegmentOption } from "@/components/ui/SegmentedControl";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { Card, Field, Input, Select } from "@/components/ui/primitives";
import { ORDER_TYPE_LABEL } from "@/lib/format";
import { ORDER_TYPE_ICONS } from "@/lib/icons";
import type { DiningTable, OrderType } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setCustomerField,
  setGuests,
  setOrderType,
  setTable,
} from "@/store/slices/cartSlice";

const ORDER_TYPES: OrderType[] = ["dine-in", "takeaway", "delivery"];
const ORDER_TYPE_OPTIONS: SegmentOption<OrderType>[] = ORDER_TYPES.map((type) => ({
  value: type,
  label: ORDER_TYPE_LABEL[type],
  icon: ORDER_TYPE_ICONS[type],
}));

export default function OrderSetup({ tables }: { tables: DiningTable[] }) {
  const dispatch = useAppDispatch();
  const { orderType, tableId, guests, customer } = useAppSelector((state) => state.cart);

  return (
    <Card className="p-4">
      <SegmentedControl
        options={ORDER_TYPE_OPTIONS}
        value={orderType}
        onChange={(type) => dispatch(setOrderType(type))}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orderType === "dine-in" ? (
          <>
            <Field label="Table" required>
              <Select
                value={tableId ?? ""}
                onChange={(event) => dispatch(setTable(event.target.value || null))}
              >
                <option value="">Select a table…</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id} disabled={table.status === "occupied"}>
                    {table.name} · {table.area} · {table.seats} seats
                    {table.status === "occupied" ? " (occupied)" : ""}
                    {table.status === "reserved" ? " (reserved)" : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Guests">
              <Input
                type="number"
                min={1}
                max={30}
                value={guests}
                onChange={(event) => dispatch(setGuests(Number(event.target.value)))}
              />
            </Field>

            <Field label="Guest name" hint="Optional — shown on the receipt">
              <Input
                value={customer.name}
                onChange={(event) =>
                  dispatch(setCustomerField({ field: "name", value: event.target.value }))
                }
                placeholder="Walk-in Guest"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Customer name" required={orderType === "delivery"}>
              <Input
                value={customer.name}
                onChange={(event) =>
                  dispatch(setCustomerField({ field: "name", value: event.target.value }))
                }
                placeholder="Full name"
              />
            </Field>

            <Field label="Contact number" required={orderType === "delivery"}>
              <Input
                value={customer.phone}
                onChange={(event) =>
                  dispatch(setCustomerField({ field: "phone", value: event.target.value }))
                }
                placeholder="+1 (555) 000-0000"
              />
            </Field>

            {orderType === "delivery" ? (
              <Field label="Delivery address" required>
                <Input
                  value={customer.address}
                  onChange={(event) =>
                    dispatch(setCustomerField({ field: "address", value: event.target.value }))
                  }
                  placeholder="Street, apartment, area"
                />
              </Field>
            ) : (
              <Field label="Pickup note" hint="Optional">
                <Input
                  value={customer.address}
                  onChange={(event) =>
                    dispatch(setCustomerField({ field: "address", value: event.target.value }))
                  }
                  placeholder="e.g. collecting at 7:30pm"
                />
              </Field>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
