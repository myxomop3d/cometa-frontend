# RelationFilter Clear Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clear button to `RelationFilter` that resets selection, grouped with the dropdown trigger via shadcn's ButtonGroup.

**Architecture:** Install shadcn's `button-group` component, then modify `DropdownPart` and `ModalPart` in `RelationFilter.tsx` to wrap trigger buttons + a conditional clear button inside `<ButtonGroup>`. The browse/modal icon button stays separate.

**Tech Stack:** React, shadcn/ui (ButtonGroup, Button), lucide-react (X icon)

**Spec:** `docs/superpowers/specs/2026-03-26-relation-filter-clear-button-design.md`

---

### Task 1: Install shadcn ButtonGroup component

**Files:**
- Create: `src/components/ui/button-group.tsx` (via shadcn CLI)

- [ ] **Step 1: Install the component**

```bash
npx shadcn@latest add button-group
```

- [ ] **Step 2: Verify the file was created**

Check that `src/components/ui/button-group.tsx` exists and exports `ButtonGroup`.

- [ ] **Step 3: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/button-group.tsx
git commit -m "feat: add shadcn ButtonGroup component"
```

---

### Task 2: Add clear button to DropdownPart

**Files:**
- Modify: `src/components/filters/RelationFilter.tsx:11,180-229`

The `DropdownPart` currently renders a `<Popover>` with a trigger button. We need to:
1. Add imports for `ButtonGroup` and `X` icon
2. Add `hasSelection` prop to `DropdownPartProps`
3. Wrap the `<Popover>` and a conditional clear button inside `<ButtonGroup>`
4. Change the PopoverTrigger button class from `w-full` to `flex-1 min-w-0`

- [ ] **Step 1: Add imports**

At the top of `RelationFilter.tsx`, add:

```tsx
import { X } from "lucide-react";
import { ButtonGroup } from "@/components/ui/button-group";
```

(`Search` is already imported from lucide-react on line 11 — add `X` alongside it.)

- [ ] **Step 2: Add `hasSelection` to DropdownPartProps and function signature**

Add to the `DropdownPartProps` interface (line 126-136):

```tsx
hasSelection: boolean;
```

Add to the destructured props of `DropdownPart` function (line 138-148):

```tsx
hasSelection,
```

- [ ] **Step 3: Wrap Popover + clear button in ButtonGroup**

Replace the return block of `DropdownPart` (lines 180-229) with:

```tsx
  return (
    <ButtonGroup className="w-full">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className="flex-1 justify-start text-left font-normal min-w-0"
            />
          }
        >
          {displayText}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 p-0 h-8 focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map((item) => {
              const id = getId(item);
              const isSelected = selectedIds.has(id);
              return (
                <div
                  key={id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent ${
                    isSelected ? "bg-accent/50" : ""
                  }`}
                  onClick={() => toggleItem(item)}
                >
                  {multi && <Checkbox checked={isSelected} />}
                  <span className="text-sm">{getLabel(item)}</span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No results
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {hasSelection && (
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Clear selection"
          onClick={(e) => {
            e.stopPropagation();
            onChange(undefined);
          }}
        >
          <X />
        </Button>
      )}
    </ButtonGroup>
  );
```

Key changes from original:
- Outer `<ButtonGroup className="w-full">` wraps everything
- PopoverTrigger button: `w-full` → `flex-1` (so it shares space with the clear button)
- Conditional clear button after `</Popover>`, inside the ButtonGroup

- [ ] **Step 4: Pass `hasSelection` from parent**

In the main `RelationFilter` component (line 90-100), add the new prop to `<DropdownPart>`:

```tsx
hasSelection={selectedItems.length > 0}
```

- [ ] **Step 5: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Visual verification**

Run: `npm run dev`
Open http://localhost:5173/box/ — verify:
- Item filter (single): dropdown shows, selecting an item shows the X clear button grouped with dropdown
- Things filter (multi): same behavior, X appears when items selected
- Clicking X clears the selection and the X disappears
- Clicking X does NOT open the dropdown popover
- Browse icon button remains separate, unaffected

- [ ] **Step 7: Commit**

```bash
git add src/components/filters/RelationFilter.tsx
git commit -m "feat: add clear button to RelationFilter DropdownPart"
```

---

### Task 3: Add clear button to ModalPart (mode="modal")

**Files:**
- Modify: `src/components/filters/RelationFilter.tsx:234-248,250,340-354`

When `displayText !== undefined` (mode="modal"), the ModalPart renders a full-width button. Wrap it + a conditional clear button in `<ButtonGroup>`. The icon-only branch (`displayText === undefined`, used in mode="both") stays unchanged.

- [ ] **Step 1: Add `hasSelection` to ModalPartProps and function signature**

Add to the `ModalPartProps` interface (line 234-248):

```tsx
hasSelection: boolean;
```

Add to the destructured props of `ModalPart` function (line 250-263):

```tsx
hasSelection,
```

- [ ] **Step 2: Wrap the displayText button branch in ButtonGroup**

Replace the `displayText !== undefined` branch (lines 342-349) with:

```tsx
      {displayText !== undefined ? (
        <ButtonGroup className="w-full">
          <Button
            variant="outline"
            className="flex-1 justify-start text-left font-normal min-w-0"
            onClick={handleOpen}
          >
            {displayText}
          </Button>
          {hasSelection && (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
            >
              <X />
            </Button>
          )}
        </ButtonGroup>
      ) : (
```

The icon-only `else` branch (lines 350-354) remains unchanged.

- [ ] **Step 3: Pass `hasSelection` from parent**

In the main `RelationFilter` component (line 104-118), add the new prop to `<ModalPart>`:

```tsx
hasSelection={selectedItems.length > 0}
```

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Visual verification**

To test mode="modal" in isolation, temporarily change one of the RelationFilters in `src/routes/box/index.tsx` to `mode="modal"` and verify:
- The display button and clear X are grouped
- The clear button works
- Revert the mode change after testing

- [ ] **Step 6: Commit**

```bash
git add src/components/filters/RelationFilter.tsx
git commit -m "feat: add clear button to RelationFilter ModalPart"
```
