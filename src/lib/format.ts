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
