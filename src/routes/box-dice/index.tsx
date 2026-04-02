import { useCallback, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import { boxesQueryOptions, patchBox } from "@/api/box";
import { itemsFilteredQueryOptions } from "@/api/item";
import { thingsFilteredQueryOptions } from "@/api/thing";
import type { BoxDto, BoxFilters } from "@/types/api";
import type {
  CellUpdate,
  FilterColumnDef,
  FilterEntry,
  SortEntry,
} from "@/types/data-grid";
import { useFilters } from "@/hooks/useFilters";
import { useServerDataGrid } from "@/hooks/useServerDataGrid";
import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridAddRow } from "@/components/data-grid/data-grid-add-row";
import { DataGridColumnHeader } from "@/components/data-grid/data-grid-column-header";
import { DataGridFilterMenu } from "@/components/data-grid/data-grid-filter-menu";
import { DataGridPagination } from "@/components/data-grid/data-grid-pagination";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { AddBoxDialog } from "./add-box-dialog";

// ── URL Search Params ──

function parseIdList(raw: unknown): number[] | undefined {
  if (typeof raw === "string" && raw.length > 0) {
    return raw
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n));
  }
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(Number).filter((n) => !isNaN(n));
  }
  return undefined;
}

function validateSearch(search: Record<string, unknown>): BoxFilters {
  return {
    page: typeof search.page === "number" ? search.page : 1,
    pageSize: typeof search.pageSize === "number" ? search.pageSize : 20,
    name: typeof search.name === "string" ? search.name : undefined,
    objectCode:
      typeof search.objectCode === "string" ? search.objectCode : undefined,
    shape:
      search.shape === "O" || search.shape === "X" ? search.shape : undefined,
    tags: typeof search.tags === "string" ? search.tags : undefined,
    numMin: typeof search.numMin === "number" ? search.numMin : undefined,
    numMax: typeof search.numMax === "number" ? search.numMax : undefined,
    checkbox:
      typeof search.checkbox === "boolean" ? search.checkbox : undefined,
    dateStrFrom:
      typeof search.dateStrFrom === "string" ? search.dateStrFrom : undefined,
    dateStrTo:
      typeof search.dateStrTo === "string" ? search.dateStrTo : undefined,
    itemId: typeof search.itemId === "number" ? search.itemId : undefined,
    thingIds: parseIdList(search.thingIds),
    oldItemId:
      typeof search.oldItemId === "number" ? search.oldItemId : undefined,
    oldThingIds: parseIdList(search.oldThingIds),
    sortBy: typeof search.sortBy === "string" ? search.sortBy : undefined,
  };
}

// ── Route Definition ──

export const Route = createFileRoute("/box-dice/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(boxesQueryOptions(deps)),
  component: BoxDicePage,
});

// ── Column Definitions ──

const columnHelper = createColumnHelper<BoxDto>();

function getColumns(
  sortBy: string | undefined,
  onSort: (columnId: string, direction: "asc" | "desc") => void,
) {
  const sortMap = new Map<string, "asc" | "desc">();
  if (sortBy) {
    for (const part of sortBy.split(",")) {
      const [field, dir] = part.trim().split(":");
      if (field && (dir === "asc" || dir === "desc")) {
        sortMap.set(field, dir);
      }
    }
  }

  return [
    columnHelper.accessor("id", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="ID"
          sortDirection={sortMap.get("id") || false}
          onSort={onSort}
        />
      ),
      size: 80,
      meta: { label: "ID" },
      enableHiding: true,
    }),
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Name"
          sortDirection={sortMap.get("name") || false}
          onSort={onSort}
        />
      ),
      size: 200,
      meta: { label: "Name", cell: { variant: "short-text" } },
    }),
    columnHelper.accessor("objectCode", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Object Code"
          sortDirection={sortMap.get("objectCode") || false}
          onSort={onSort}
        />
      ),
      size: 150,
      meta: { label: "Object Code", cell: { variant: "short-text" } },
    }),
    columnHelper.accessor("shape", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Shape"
          sortDirection={sortMap.get("shape") || false}
          onSort={onSort}
        />
      ),
      size: 100,
      meta: {
        label: "Shape",
        cell: {
          variant: "select",
          options: [
            { label: "O", value: "O" },
            { label: "X", value: "X" },
          ],
        },
      },
    }),
    columnHelper.accessor("num", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Num"
          sortDirection={sortMap.get("num") || false}
          onSort={onSort}
        />
      ),
      size: 100,
      meta: { label: "Num", cell: { variant: "number" } },
    }),
    columnHelper.accessor("dateStr", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Date"
          sortDirection={sortMap.get("dateStr") || false}
          onSort={onSort}
        />
      ),
      size: 150,
      meta: { label: "Date", cell: { variant: "date" } },
    }),
    columnHelper.accessor("checkbox", {
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title="Checkbox"
          sortDirection={sortMap.get("checkbox") || false}
          onSort={onSort}
        />
      ),
      size: 100,
      meta: { label: "Checkbox", cell: { variant: "checkbox" } },
    }),
    columnHelper.accessor("tags", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Tags" />
      ),
      size: 200,
      meta: { label: "Tags", cell: { variant: "short-text" } },
      cell: ({ getValue }) => {
        const tags = getValue();
        return tags?.join(", ") ?? "";
      },
    }),
    columnHelper.accessor("item", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Item" />
      ),
      size: 180,
      meta: {
        label: "Item",
        cell: {
          variant: "relation-single",
          queryOptions: (filters: Record<string, unknown>) =>
            itemsFilteredQueryOptions(filters),
          displayField: "name",
          idField: "id",
        },
      },
    }),
    columnHelper.accessor("things", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Things" />
      ),
      size: 220,
      meta: {
        label: "Things",
        cell: {
          variant: "relation-multi",
          queryOptions: (filters: Record<string, unknown>) =>
            thingsFilteredQueryOptions(filters),
          displayField: "name",
          idField: "id",
        },
      },
    }),
    columnHelper.accessor("oldItem", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Old Item" />
      ),
      size: 180,
      meta: {
        label: "Old Item",
        cell: {
          variant: "relation-single",
          queryOptions: (filters: Record<string, unknown>) =>
            itemsFilteredQueryOptions(filters),
          displayField: "name",
          idField: "id",
        },
      },
    }),
    columnHelper.accessor("oldThings", {
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Old Things" />
      ),
      size: 220,
      meta: {
        label: "Old Things",
        cell: {
          variant: "relation-multi",
          queryOptions: (filters: Record<string, unknown>) =>
            thingsFilteredQueryOptions(filters),
          displayField: "name",
          idField: "id",
        },
      },
    }),
  ];
}

// ── Sort/Filter Helpers ──

function parseSortBy(sortBy: string | undefined): SortEntry[] {
  if (!sortBy) return [];
  return sortBy
    .split(",")
    .map((part) => {
      const [field, dir] = part.trim().split(":");
      if (field && (dir === "asc" || dir === "desc")) {
        return { id: field, desc: dir === "desc" };
      }
      return null;
    })
    .filter((s): s is SortEntry => s !== null);
}

function serializeSortBy(sorting: SortEntry[]): string | undefined {
  if (sorting.length === 0) return undefined;
  return sorting.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
}

const FILTER_COLUMNS: FilterColumnDef[] = [
  { id: "name", label: "Name", variant: "short-text" },
  { id: "objectCode", label: "Object Code", variant: "short-text" },
  {
    id: "shape",
    label: "Shape",
    variant: "select",
    options: [
      { label: "O", value: "O" },
      { label: "X", value: "X" },
    ],
  },
  { id: "num", label: "Num", variant: "number" },
  { id: "dateStr", label: "Date", variant: "date" },
  { id: "checkbox", label: "Checkbox", variant: "checkbox" },
  { id: "tags", label: "Tags", variant: "short-text" },
];

const SORTABLE_COLUMNS = [
  { id: "id", label: "ID" },
  { id: "name", label: "Name" },
  { id: "objectCode", label: "Object Code" },
  { id: "shape", label: "Shape" },
  { id: "num", label: "Num" },
  { id: "dateStr", label: "Date" },
  { id: "checkbox", label: "Checkbox" },
];

function filtersToEntries(filters: BoxFilters): FilterEntry[] {
  const entries: FilterEntry[] = [];
  if (filters.name) {
    entries.push({ id: "name", operator: "contains", value: filters.name });
  }
  if (filters.objectCode) {
    entries.push({
      id: "objectCode",
      operator: "contains",
      value: filters.objectCode,
    });
  }
  if (filters.shape) {
    entries.push({ id: "shape", operator: "is", value: filters.shape });
  }
  if (filters.numMin != null || filters.numMax != null) {
    if (filters.numMin != null && filters.numMax != null) {
      entries.push({
        id: "num",
        operator: "isBetween",
        value: filters.numMin,
        endValue: filters.numMax,
      });
    } else if (filters.numMin != null) {
      entries.push({
        id: "num",
        operator: "greaterThanOrEqual",
        value: filters.numMin,
      });
    } else if (filters.numMax != null) {
      entries.push({
        id: "num",
        operator: "lessThanOrEqual",
        value: filters.numMax,
      });
    }
  }
  if (filters.dateStrFrom || filters.dateStrTo) {
    if (filters.dateStrFrom && filters.dateStrTo) {
      entries.push({
        id: "dateStr",
        operator: "isBetween",
        value: filters.dateStrFrom,
        endValue: filters.dateStrTo,
      });
    } else if (filters.dateStrFrom) {
      entries.push({
        id: "dateStr",
        operator: "onOrAfter",
        value: filters.dateStrFrom,
      });
    } else if (filters.dateStrTo) {
      entries.push({
        id: "dateStr",
        operator: "onOrBefore",
        value: filters.dateStrTo,
      });
    }
  }
  if (filters.checkbox != null) {
    entries.push({
      id: "checkbox",
      operator: filters.checkbox ? "isTrue" : "isFalse",
    });
  }
  if (filters.tags) {
    entries.push({ id: "tags", operator: "contains", value: filters.tags });
  }
  return entries;
}

function entriesToFilters(entries: FilterEntry[]): Partial<BoxFilters> {
  const result: Partial<BoxFilters> = {
    name: undefined,
    objectCode: undefined,
    shape: undefined,
    numMin: undefined,
    numMax: undefined,
    dateStrFrom: undefined,
    dateStrTo: undefined,
    checkbox: undefined,
    tags: undefined,
  };

  for (const entry of entries) {
    switch (entry.id) {
      case "name":
        result.name = entry.value as string | undefined;
        break;
      case "objectCode":
        result.objectCode = entry.value as string | undefined;
        break;
      case "shape":
        result.shape = entry.value as "O" | "X" | undefined;
        break;
      case "num":
        if (entry.operator === "isBetween") {
          result.numMin = entry.value as number | undefined;
          result.numMax = entry.endValue as number | undefined;
        } else if (
          entry.operator === "greaterThan" ||
          entry.operator === "greaterThanOrEqual"
        ) {
          result.numMin = entry.value as number | undefined;
        } else if (
          entry.operator === "lessThan" ||
          entry.operator === "lessThanOrEqual"
        ) {
          result.numMax = entry.value as number | undefined;
        } else if (entry.operator === "equals") {
          result.numMin = entry.value as number | undefined;
          result.numMax = entry.value as number | undefined;
        }
        break;
      case "dateStr":
        if (entry.operator === "isBetween") {
          result.dateStrFrom = entry.value as string | undefined;
          result.dateStrTo = (entry.endValue as string) ?? undefined;
        } else if (
          entry.operator === "after" ||
          entry.operator === "onOrAfter"
        ) {
          result.dateStrFrom = entry.value as string | undefined;
        } else if (
          entry.operator === "before" ||
          entry.operator === "onOrBefore"
        ) {
          result.dateStrTo = entry.value as string | undefined;
        } else if (entry.operator === "equals") {
          result.dateStrFrom = entry.value as string | undefined;
          result.dateStrTo = entry.value as string | undefined;
        }
        break;
      case "checkbox":
        result.checkbox =
          entry.operator === "isTrue"
            ? true
            : entry.operator === "isFalse"
              ? false
              : undefined;
        break;
      case "tags":
        result.tags = entry.value as string | undefined;
        break;
    }
  }

  return result;
}

// ── Page Component ──

function BoxDicePage() {
  const { filters, setFilters, setPage } = useFilters("/box-dice/");
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: boxesResponse } = useSuspenseQuery(boxesQueryOptions(filters));
  const boxes = boxesResponse.data;
  const totalCount = boxesResponse.count;

  // Patch mutation
  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BoxDto> }) =>
      patchBox(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
    },
  });

  // Refs to break dependency cycles (setFilters is not stable)
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const setFiltersRef = useRef(setFilters);
  setFiltersRef.current = setFilters;

  // Sort handler: toggles or sets sort direction, updates URL
  const onSort = useCallback(
    (columnId: string, direction: "asc" | "desc") => {
      const currentSortBy = filtersRef.current.sortBy ?? "";
      const parts = currentSortBy
        .split(",")
        .filter((p) => p.trim().length > 0);

      // Remove existing sort for this column
      const filtered = parts.filter(
        (p) => !p.trim().startsWith(columnId + ":"),
      );

      // Check if same direction already set (toggle off)
      const existing = parts.find((p) => p.trim().startsWith(columnId + ":"));
      if (existing === `${columnId}:${direction}`) {
        setFiltersRef.current({
          sortBy: filtered.length > 0 ? filtered.join(",") : undefined,
        } as Partial<BoxFilters>);
      } else {
        filtered.unshift(`${columnId}:${direction}`);
        setFiltersRef.current({
          sortBy: filtered.join(","),
        } as Partial<BoxFilters>);
      }
    },
    [],
  );

  const columns = useMemo(
    () => getColumns(filters.sortBy, onSort),
    [filters.sortBy, onSort],
  );

  // Sort menu state
  const sorting = useMemo(
    () => parseSortBy(filters.sortBy),
    [filters.sortBy],
  );

  const onSortingChange = useCallback(
    (newSorting: SortEntry[]) => {
      setFiltersRef.current({
        sortBy: serializeSortBy(newSorting),
      } as Partial<BoxFilters>);
    },
    [],
  );

  // Filter menu state
  const filterEntries = useMemo(
    () => filtersToEntries(filters),
    [filters],
  );

  const onFiltersChange = useCallback(
    (entries: FilterEntry[]) => {
      setFiltersRef.current({
        ...entriesToFilters(entries),
        page: 1,
      } as Partial<BoxFilters>);
    },
    [],
  );

  // Handle cell data updates
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const mutateRef = useRef(patchMutation.mutate);
  mutateRef.current = patchMutation.mutate;

  const onDataUpdate = useCallback(
    (params: CellUpdate | CellUpdate[]) => {
      const updates = Array.isArray(params) ? params : [params];
      for (const update of updates) {
        const row = boxesRef.current[update.rowIndex];
        if (!row) continue;

        const patch: Partial<BoxDto> = {};
        const columnId = update.columnId as keyof BoxDto;

        if (columnId === "tags") {
          const val = update.value;
          if (typeof val === "string") {
            patch.tags = val
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
          } else {
            patch.tags = val as string[];
          }
        } else {
          (patch as Record<string, unknown>)[columnId] = update.value;
        }

        mutateRef.current({ id: row.id, data: patch });
      }
    },
    [],
  );

  const grid = useServerDataGrid({
    data: boxes,
    columns,
    totalCount,
    onDataUpdate,
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Box Dice</h1>
          <p className="text-sm text-muted-foreground">{totalCount} boxes</p>
        </div>
        <div className="flex items-center gap-2">
          <DataGridFilterMenu
            columns={FILTER_COLUMNS}
            filters={filterEntries}
            onFiltersChange={onFiltersChange}
          />
          <DataGridSortMenu
            columns={SORTABLE_COLUMNS}
            sorting={sorting}
            onSortingChange={onSortingChange}
          />
          <DataGridViewMenu table={grid.table} />
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <PlusIcon className="size-4" />
            Add Box
          </Button>
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid {...grid} height={600} />

      {/* Add Row + Pagination */}
      <DataGridAddRow onAddRow={() => setAddDialogOpen(true)} label="Add box" />
      <DataGridPagination
        page={filters.page ?? 1}
        pageSize={filters.pageSize ?? 20}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      {/* Add Box Dialog */}
      <AddBoxDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
