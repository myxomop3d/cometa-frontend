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
    background: isPinned ? "var(--background)" : "var(--background)",
    width: column.getSize(),
    zIndex: isPinned ? 1 : undefined,
  };
}

export function calculatePageSize(offsetPx = 280): number {
  if (typeof window === "undefined") return 20;
  const available = window.innerHeight - offsetPx;
  const ideal = Math.floor(available / 40);
  const steps = [10, 20, 30, 40, 50];
  return steps.reduce((prev, curr) =>
    Math.abs(curr - ideal) < Math.abs(prev - ideal) ? curr : prev
  );
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
