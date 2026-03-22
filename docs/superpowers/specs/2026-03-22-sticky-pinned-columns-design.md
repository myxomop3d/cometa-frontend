# Sticky Pinned Columns for SimpleTable

**Date:** 2026-03-22
**Status:** Draft

## Overview

Add horizontal scrolling and sticky column pinning to `SimpleTable`. The actions column (when `editConfig` is present) is always pinned to the right. An optional `pinnedLeftColumnId` prop pins one data column to the left. Unpinned columns scroll horizontally between them.

## Changes to SimpleTable

### Scrollable Container

Wrap the existing `<Table>` in `<div className="overflow-x-auto">`. The table retains its `table-fixed` layout and natural width (sum of column sizes). When it exceeds the container width, a horizontal scrollbar appears.

### New Prop

```ts
interface SimpleTableProps<TData> {
  // ... existing props ...
  pinnedLeftColumnId?: string;  // column ID to pin to the left
}
```

### Sticky Styling

Pinned cells (`<TableHead>` and `<TableCell>`) receive:

**Left-pinned column:**
```
position: sticky
left: 0
z-index: 10
background: bg-background (opaque, so scrolling content doesn't show through)
box-shadow: shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] (subtle inner-edge shadow)
```

**Right-pinned actions column:**
```
position: sticky
right: 0
z-index: 10
background: bg-background
box-shadow: shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]
```

### Background Color for Editing Row

Sticky cells need opaque backgrounds. For the editing row (which has `bg-muted/30`), the sticky cells use `bg-muted` to match visually while remaining opaque.

### No Column Visibility for Pinned Columns

The left-pinned column should not be hideable via the column visibility dropdown. The consumer can set `enableHiding: false` on the pinned column definition if desired — SimpleTable does not enforce this automatically.

## Consumer Usage

```tsx
<SimpleTable
  table={table}
  pinnedLeftColumnId="name"
  editConfig={editConfig}
  // ... other props
/>
```

## File Changes

| File | Change |
|------|--------|
| `src/components/SimpleTable.tsx` | **Modified** — add scroll wrapper, `pinnedLeftColumnId` prop, sticky styles on pinned header/cells |
| `src/routes/automated-system/index.tsx` | **Modified** — pass `pinnedLeftColumnId="name"` |

## Non-Breaking

SimpleTable without `pinnedLeftColumnId` behaves as before (scrollable container is added but has no visual impact when content fits). Actions column pinning is automatic when `editConfig` is present.
