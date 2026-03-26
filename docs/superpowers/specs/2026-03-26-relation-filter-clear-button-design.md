# RelationFilter Clear Button

## Overview

Add a clear button to `RelationFilter` so users can reset their selection. The clear button appears only when items are selected. It is grouped with the dropdown trigger using a new `ButtonGroup` component, while the modal browse button remains separate.

## New Component: ButtonGroup

**File:** `src/components/ui/button-group.tsx`

A wrapper that emits `data-slot="button-group"` and handles first/last child rounding so grouped buttons visually merge into a single unit.

```tsx
function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="button-group"
      className={cn(
        "inline-flex items-center -space-x-px",
        "[&>*:first-child]:rounded-r-none",
        "[&>*:last-child]:rounded-l-none",
        "[&>*:not(:first-child):not(:last-child)]:rounded-none",
        "[&>*]:focus:z-10",
        className
      )}
      {...props}
    />
  );
}
```

The existing button CVA config already has `in-data-[slot=button-group]:rounded-lg` on smaller sizes (normalizes their tighter radii). The `ButtonGroup` component itself handles the actual grouping: removing inner border-radii via first/last child selectors, `-space-x-px` for border overlap, and `focus:z-10` so focus rings render above neighbors.

## Changes to RelationFilter

### DropdownPart

Wrap the `PopoverTrigger` button and a conditional clear button inside `<ButtonGroup>`:

```
[ Dropdown trigger | Clear X ]
```

- Clear button: `<Button variant="outline" size="icon-sm" aria-label="Clear selection">` with `X` icon from lucide-react
- Rendered only when `selectedItems.length > 0`
- On click: calls `onChange(undefined)` and `e.stopPropagation()` to prevent popover toggle
- The PopoverTrigger button changes from `w-full` to `flex-1 min-w-0` so the clear button gets space within the flex group

### ModalPart (mode="modal")

When `displayText` is rendered as a full button (`displayText !== undefined` branch only), wrap it with the clear button in `<ButtonGroup>` the same way. The icon-only branch (`displayText === undefined`, used in `mode="both"`) remains unchanged — it renders just the browse icon button with no grouping.

### Main Layout

No changes to the outer `<div className="flex gap-1">`. The ButtonGroup is nested inside each part's slot. Final layout for `mode="both"`:

```
[ Dropdown trigger | Clear X ]  [ Browse icon ]
```

For `mode="modal"`:

```
[ Display button | Clear X ]
```

### Props

No new props. `onChange(undefined)` already represents "clear" for both single (`T | undefined`) and multi (`T[] | undefined`) modes. No consumer changes needed — the clear button triggers the same `onChange` callback that already updates URL filters in `box/index.tsx`.

## Affected Files

1. `src/components/ui/button-group.tsx` — new file
2. `src/components/filters/RelationFilter.tsx` — add clear button + ButtonGroup usage
