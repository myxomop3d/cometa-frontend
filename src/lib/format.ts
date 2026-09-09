import { format } from "date-fns";

export function formatDate(
  date: Date | string | number | undefined | null
): string {
  if (!date) return "";
  const d =
    typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return format(d, "MMM d, yyyy");
}

/** Display fallback for an empty cell. Both spellings of empty reach the UI:
 *  legacy NULLs and the "" that a cleared field now writes.
 *  Note the explicit checks — `value || "—"` would turn a real 0 into a dash. */
export function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
