# Related Object Field Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable advanced table filtering by fields of related objects (e.g., filter boxes by `item.name`) using hidden columns with standard variants.

**Architecture:** Hidden TanStack Table columns with dot-notation IDs (`item.name`) map to OData nested paths (`item/name`) via `fieldByColumnId`. No new variants, toolbar changes, or mock changes — the existing infrastructure handles everything.

**Tech Stack:** TanStack Table 8, TanStack Router, TanStack Query 5, OData filter builder

---

### Task 1: Add `initialColumnVisibility` support to `useDataTable`

The hook currently hardcodes `columnVisibility` to `{}`. We need to accept an initial value so pages can hide columns by default.

**Files:**
- Modify: `src/hooks/use-data-table.ts`

- [ ] **Step 1: Add `initialColumnVisibility` to the options interface**

In `src/hooks/use-data-table.ts`, add the new optional prop to `UseDataTableOptions`:

```ts
interface UseDataTableOptions<TData, TSearch extends Record<string, unknown>> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  pageCount: number;
  search: TSearch;
  onNavigate: (updates: Partial<TSearch>) => void;
  sortKey?: string;
  pageKey?: string;
  pageSizeKey?: string;
  defaultPageSize?: number;
  initialColumnPinning?: ColumnPinningState;
  initialColumnVisibility?: VisibilityState;           // <-- add this
}
```

- [ ] **Step 2: Destructure and use the new prop**

In the `useDataTable` function signature, destructure `initialColumnVisibility` alongside `initialColumnPinning`. Then change the `columnVisibility` state initialization:

```ts
export function useDataTable<TData, TSearch extends Record<string, unknown>>({
  columns,
  data,
  pageCount,
  search,
  onNavigate,
  sortKey = "sort",
  pageKey = "page",
  pageSizeKey = "pageSize",
  defaultPageSize,
  initialColumnPinning,
  initialColumnVisibility,        // <-- add this
}: UseDataTableOptions<TData, TSearch>) {
```

Change line 110 from:

```ts
const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
```

to:

```ts
const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility ?? {});
```

- [ ] **Step 3: Verify the app still compiles**

Run: `npx tsc --noEmit`
Expected: no errors (the new prop is optional, so existing call sites are unaffected)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-data-table.ts
git commit -m "feat: add initialColumnVisibility support to useDataTable"
```

---

### Task 2: Add `item.name` field mapping to box advanced API

**Files:**
- Modify: `src/features/box/advanced-api.ts`

- [ ] **Step 1: Add the field entry**

In `src/features/box/advanced-api.ts`, add the new entry to `boxFieldByColumnId` after the existing `item` entry (line 23):

```ts
export const boxFieldByColumnId: Record<string, FieldEntry> = {
  name:       { field: "name",       variant: "text" },
  objectCode: { field: "objectCode", variant: "text" },
  shape:      { field: "shape",      variant: "select" },
  num:        { field: "num",        variant: "range" },
  dateStr:    { field: "dateStr",    variant: "dateRange" },
  checkbox:   { field: "checkbox",   variant: "boolean" },
  tags:       { field: "tags",       variant: "text" },
  item:       { field: "item",       variant: "relation" },
  "item.name": { field: "item/name", variant: "text" },       // <-- add this
  things:     { field: "things",     variant: "multiRelation" },
  oldItem:    { field: "oldItem",    variant: "relation" },
  oldThings:  { field: "oldThings",  variant: "multiRelation" },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/box/advanced-api.ts
git commit -m "feat: add item.name field mapping for advanced filtering"
```

---

### Task 3: Add hidden `item.name` column to box columns

**Files:**
- Modify: `src/features/box/columns.tsx`

- [ ] **Step 1: Add the hidden column definition**

In `src/features/box/columns.tsx`, inside the `getBoxColumns` return array, add a new column **after** the existing `item` column (after line 168) and **before** the `things` column:

```tsx
    {
      id: "item.name",
      accessorFn: (row) => row.item?.name ?? "—",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Item → Name" />
      ),
      meta: {
        label: "Item → Name",
        variant: "text",
        placeholder: "Search item names...",
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: true,
      size: 160,
    },
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/box/columns.tsx
git commit -m "feat: add hidden item.name column for related field filtering"
```

---

### Task 4: Hide `item.name` column by default in the route page

**Files:**
- Modify: `src/routes/box-dice-advanced/index.tsx`

- [ ] **Step 1: Pass `initialColumnVisibility` to `useDataTable`**

In `src/routes/box-dice-advanced/index.tsx`, find the `useDataTable` call (around line 120) and add the `initialColumnVisibility` prop:

```tsx
  const { table } = useDataTable({
    columns,
    data: data.data,
    pageCount,
    search: search as unknown as Record<string, unknown>,
    onNavigate,
    initialColumnPinning: { left: ["select", "id"], right: ["actions"] },
    initialColumnVisibility: { "item.name": false },       // <-- add this
  });
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/box-dice-advanced/index.tsx
git commit -m "feat: hide item.name column by default in box-dice-advanced"
```

---

### Task 5: Manual verification with mock API

**Files:** none (testing only)

- [ ] **Step 1: Start dev server with mock API**

Run: `VITE_MOCK_API=true npm run dev`

- [ ] **Step 2: Verify the filter appears in the dropdown**

1. Navigate to `/box-dice-advanced/`
2. Click "Add filter" in the advanced toolbar
3. Confirm "Item → Name" appears in the field picker list
4. Select it — should show a text input with "Search item names..." placeholder
5. Confirm operator options are: contains, is, is not, empty, not empty

- [ ] **Step 3: Verify filtering works**

1. Add a filter: "Item → Name" contains "item"
2. Confirm the table filters down to only boxes whose related item's name contains "item"
3. Check the URL — should contain a `filters` param with `{"id":"item.name","operator":"iLike","value":"..."}`

- [ ] **Step 4: Verify the column visibility toggle**

1. Open the column visibility menu (View Options button)
2. Confirm "Item → Name" is listed and unchecked (hidden)
3. Check it — the column should appear in the table
4. Uncheck it — the column should disappear, but the filter should still work

---

### Task 6: Update the advanced table manual

**Files:**
- Modify: `advanced-table-manual.md`

- [ ] **Step 1: Add a new "Common Patterns" subsection**

In `advanced-table-manual.md`, after the "Adding a relation filter" subsection (around line 762) and before "Adding a multi-select filter", add:

````markdown
### Filtering by related object fields

Filter by a field of a related object (e.g., find boxes where `item.name` contains "foo") without the RelationPicker. Uses a hidden column with a standard variant.

1. In `columns.tsx`, add a hidden column with dot-notation ID and the variant matching the field type:

```tsx
{
  id: "item.name",
  accessorFn: (row) => row.item?.name ?? "—",
  header: ({ column }) => (
    <DataTableColumnHeader column={column} label="Item → Name" />
  ),
  meta: {
    label: "Item → Name",
    variant: "text",              // matches the field's type
    placeholder: "Search item names...",
  },
  enableColumnFilter: true,
  enableSorting: false,
  enableHiding: true,
  size: 160,
}
```

2. In `advanced-api.ts`, map the dot-notation ID to the OData path:

```ts
"item.name": { field: "item/name", variant: "text" },
```

3. In the route page, hide the column by default:

```ts
initialColumnVisibility: { "item.name": false },
```

The variant determines behavior — use `"text"` for name fields, `"range"` for numeric fields, `"select"` for enums, `"dateRange"` for dates. Examples:

| Column ID | OData Field | Variant | Filter Behavior |
|-----------|-------------|---------|-----------------|
| `item.name` | `item/name` | `text` | contains, is, is not, empty |
| `item.count` | `item/count` | `range` | between, eq, lt, gt, etc. |
| `item.status` | `item/status` | `select` | is, is not, empty |
| `item.date` | `item/date` | `dateRange` | between, before, after, etc. |
````

- [ ] **Step 2: Add checklist item**

In the Checklist section at the bottom of `advanced-table-manual.md`, add after the `fieldByColumnId` entry:

```markdown
- [ ] Related field filters: hidden column with dot-notation ID + matching `fieldByColumnId` entry + `initialColumnVisibility`
```

- [ ] **Step 3: Commit**

```bash
git add advanced-table-manual.md
git commit -m "docs: add related object field filtering pattern to advanced table manual"
```
