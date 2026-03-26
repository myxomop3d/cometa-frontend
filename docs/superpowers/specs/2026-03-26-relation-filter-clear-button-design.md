# RelationFilter Clear Button

## Overview

Add a clear button to `RelationFilter` so users can reset their selection. The clear button appears only when items are selected. It is grouped with the dropdown trigger using a new `ButtonGroup` component, while the modal browse button remains separate.

## ButtonGroup Component

Install shadcn's official button-group component:

```bash
npx shadcn@latest add button-group
```

This adds `src/components/ui/button-group.tsx` with `data-slot="button-group"`, first/last child rounding, border overlap, and focus z-index — all matching the existing `in-data-[slot=button-group]` styles in the button CVA config.

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

1. `src/components/ui/button-group.tsx` — added via `npx shadcn@latest add button-group`
2. `src/components/filters/RelationFilter.tsx` — add clear button + ButtonGroup usage
