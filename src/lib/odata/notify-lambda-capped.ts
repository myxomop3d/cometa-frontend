import { toast } from "sonner";
import type { CappedLambdaInfo } from "./build-filter-params";

/**
 * User-facing counterpart to `joinWithCappedLambdas`'s `console.warn`.
 *
 * `buildFilterParams`/`buildAdvancedFilterParams` are pure and may not fire
 * UI side effects themselves — they only *report* a capped lambda via the
 * `onLambdaCapped` callback. This function is that callback's implementation,
 * wired in at the queryFn layer (`create-crud-api.ts`,
 * `features/*\/advanced-api.ts`), which only runs when a fetch actually
 * happens (not on every render), so it can't spam.
 */
export function notifyLambdaCapped({ keptField, droppedCount }: CappedLambdaInfo): void {
  const skipped =
    droppedCount === 1 ? "1 other filter" : `${droppedCount} other filters`;
  toast.warning(
    `Only one collection filter can be applied at a time — showing results for "${keptField}" only (${skipped} skipped).`,
  );
}
