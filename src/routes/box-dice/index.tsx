import { useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { boxesQueryOptions, patchBox } from "@/api/box";
import { itemsFilteredQueryOptions } from "@/api/item";
import { thingsFilteredQueryOptions } from "@/api/thing";
import type { BoxDto, BoxFilters } from "@/types/api";
import type { CellUpdate } from "@/types/data-grid";
import { useFilters } from "@/hooks/useFilters";
import { useServerDataGrid } from "@/hooks/useServerDataGrid";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/data-grid/data-grid-column-header";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { DataGridPagination } from "@/components/data-grid/data-grid-pagination";

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
      enableHiding: false,
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

// ── Page Component ──

function BoxDicePage() {
  const { filters, setFilters, setPage } = useFilters("/box-dice/");
  const queryClient = useQueryClient();

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

  // Sort handler: toggles or sets sort direction, updates URL
  const onSort = useCallback(
    (columnId: string, direction: "asc" | "desc") => {
      const currentSortBy = filters.sortBy ?? "";
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
        setFilters({
          sortBy: filtered.length > 0 ? filtered.join(",") : undefined,
        } as Partial<BoxFilters>);
      } else {
        filtered.unshift(`${columnId}:${direction}`);
        setFilters({
          sortBy: filtered.join(","),
        } as Partial<BoxFilters>);
      }
    },
    [filters.sortBy, setFilters],
  );

  const columns = useMemo(
    () => getColumns(filters.sortBy, onSort),
    [filters.sortBy, onSort],
  );

  // Handle cell data updates
  const onDataUpdate = useCallback(
    (params: CellUpdate | CellUpdate[]) => {
      const updates = Array.isArray(params) ? params : [params];
      for (const update of updates) {
        const row = boxes[update.rowIndex];
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
        } else if (
          columnId === "item" ||
          columnId === "oldItem" ||
          columnId === "things" ||
          columnId === "oldThings"
        ) {
          (patch as Record<string, unknown>)[columnId] = update.value;
        } else {
          (patch as Record<string, unknown>)[columnId] = update.value;
        }

        patchMutation.mutate({ id: row.id, data: patch });
      }
    },
    [boxes, patchMutation],
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
          <DataGridViewMenu table={grid.table} />
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid {...grid} height={600} />

      {/* Pagination */}
      <DataGridPagination
        page={filters.page ?? 1}
        pageSize={filters.pageSize ?? 20}
        totalCount={totalCount}
        onPageChange={setPage}
      />
    </div>
  );
}
