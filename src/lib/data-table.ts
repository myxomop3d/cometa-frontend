import type { Column } from "@tanstack/react-table";

export function getColumnPinningStyle<TData>({
  column,
  withBorder = false,
}: {
  column: Column<TData>;
  withBorder?: boolean;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  return {
    boxShadow: withBorder
      ? isLastLeftPinnedColumn
        ? "-4px 0 4px -4px var(--border) inset"
        : isFirstRightPinnedColumn
          ? "4px 0 4px -4px var(--border) inset"
          : undefined
      : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? "sticky" : "relative",
    background: isPinned ? "var(--background)" : undefined,
    width: column.getSize(),
    minWidth: column.getSize(),
    zIndex: isPinned ? 1 : undefined,
  };
}

/**
 * Height of one rendered body row: a `TableCell`'s `p-2` around a single line
 * of text. Measured, not assumed — the 40px the original estimate used is the
 * height of the *header* row, which is why every page came out too tall.
 */
export const TABLE_ROW_HEIGHT_PX = 49;

/**
 * Everything on a table page that is not a body row: `main`'s `p-6`, the page
 * heading, the toolbar, the table header, the gap, the pagination bar, and the
 * horizontal scrollbar a wider-than-viewport table adds.
 *
 * Measured at 313px on /automated-system (toolbar wrapped to two lines + a
 * horizontal scrollbar) and 258px on /team and /person. The worst case is used
 * so a page never spills below the fold; the cost is one unused row on the
 * pages whose toolbar fits on one line.
 */
export const TABLE_CHROME_PX = 313;

/** Selectable page sizes, in steps of 5. */
export const PAGE_SIZE_STEPS = [10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

/**
 * Largest page size that fits the viewport without pushing rows below the fold.
 *
 * Snaps *down* to a step: rounding to the nearest one (what this did before)
 * picks a size larger than what fits whenever the ideal count sits above a
 * step's midpoint.
 */
export function calculatePageSize(
  viewportHeight: number | null = typeof window === "undefined"
    ? null
    : window.innerHeight,
  chromePx = TABLE_CHROME_PX,
): number {
  const smallest = PAGE_SIZE_STEPS[0];
  if (viewportHeight === null) return smallest;
  const fits = Math.floor((viewportHeight - chromePx) / TABLE_ROW_HEIGHT_PX);
  let size: number = smallest;
  for (const step of PAGE_SIZE_STEPS) {
    if (step <= fits) size = step;
  }
  return size;
}

export function parseSorting(
  sortStr: string | undefined
): { id: string; desc: boolean }[] {
  if (!sortStr) return [];
  return sortStr.split(",").map((part) => {
    const [id, dir] = part.split(".");
    return { id: id!, desc: dir === "desc" };
  });
}

export function serializeSorting(
  sorting: { id: string; desc: boolean }[]
): string | undefined {
  if (sorting.length === 0) return undefined;
  return sorting.map((s) => `${s.id}.${s.desc ? "desc" : "asc"}`).join(",");
}
