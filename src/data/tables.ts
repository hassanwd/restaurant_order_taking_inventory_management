import type { DiningTable } from "@/lib/types";

export const TABLES: DiningTable[] = [
  { id: "T1", name: "Table 1", seats: 2, area: "Window", status: "free" },
  { id: "T2", name: "Table 2", seats: 2, area: "Window", status: "occupied" },
  { id: "T3", name: "Table 3", seats: 4, area: "Main Hall", status: "free" },
  { id: "T4", name: "Table 4", seats: 4, area: "Main Hall", status: "occupied" },
  { id: "T5", name: "Table 5", seats: 6, area: "Main Hall", status: "free" },
  { id: "T6", name: "Table 6", seats: 6, area: "Terrace", status: "reserved" },
  { id: "T7", name: "Table 7", seats: 8, area: "Terrace", status: "free" },
  { id: "T8", name: "Booth A", seats: 4, area: "Booths", status: "free" },
  { id: "T9", name: "Booth B", seats: 4, area: "Booths", status: "occupied" },
  { id: "T10", name: "Bar 1", seats: 1, area: "Bar", status: "free" },
  { id: "T11", name: "Bar 2", seats: 1, area: "Bar", status: "free" },
  { id: "T12", name: "Private Room", seats: 12, area: "Private", status: "reserved" },
];

export const findTable = (id: string | null) =>
  id ? TABLES.find((table) => table.id === id) : undefined;
