# RelationFilter Clear Button

## Overview

Add a clear button to `RelationFilter` so users can reset their selection. The clear button appears only when items are selected. It is grouped with the dropdown trigger using a new `ButtonGroup` component, while the modal browse button remains separate.

## New Component: ButtonGroup

**File:** `src/components/ui/button-group.tsx`

A minimal wrapper that emits `data-slot="button-group"` so child `Button` components pick up the existing `in-data-[slot=button-group]:rounded-lg` styles (border-radius adjustments, negative margin overlap).

```tsx
<div data-slot="button-group" className="flex items-center -space-x-px ...">
  {children}
</div>
```

No new button variants needed — the existing CVA config already handles button-group context.

## Changes to RelationFilter

### DropdownPart

Wrap the `PopoverTrigger` button and a conditional clear button inside `<ButtonGroup>`:

```
[ Dropdown trigger | Clear X ]
```

- Clear button: `<Button variant="outline" size="icon-sm">` with `X` icon from lucide-react
- Rendered only when `selectedItems.length > 0`
- On click: calls `onChange(undefined)` and `e.stopPropagation()` to prevent popover toggle

### ModalPart (mode="modal")

When `displayText` is rendered as a full button (mode="modal", no dropdown), wrap it with the clear button in `<ButtonGroup>` the same way. The browse icon button stays outside the group.

### Main Layout

No changes to the outer `<div className="flex gap-1">`. The ButtonGroup is nested inside each part's slot. Final layout for `mode="both"`:

```
[ Dropdown trigger | Clear X ]  [ Browse icon ]
```

### Props

No new props. `onChange(undefined)` already represents "clear" for both single (`T | undefined`) and multi (`T[] | undefined`) modes.

## Affected Files

1. `src/components/ui/button-group.tsx` — new file
2. `src/components/filters/RelationFilter.tsx` — add clear button + ButtonGroup usage
