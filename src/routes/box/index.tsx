import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  type ColumnResizeMode,
  type VisibilityState,
} from "@tanstack/react-table";
import { z } from "zod";
import { boxesQueryOptions, patchBox } from "@/api/box";
import { itemsQueryOptions, itemsFilteredQueryOptions } from "@/api/item";
import { thingsQueryOptions, thingsFilteredQueryOptions } from "@/api/thing";
import type { BoxDto, BoxFilters, ItemDto, ThingDto } from "@/types/api";
import type { ColumnDef } from "@tanstack/react-table";
import { SimpleTable } from "@/components/SimpleTable";
import { useFilters } from "@/hooks/useFilters";
import type { EditConfig } from "@/types/table";
import { FilterBar } from "@/components/filters/FilterBar";
import { TextFilter } from "@/components/filters/TextFilter";
import { NumberRangeFilter } from "@/components/filters/NumberRangeFilter";
import { CheckboxFilter } from "@/components/filters/CheckboxFilter";
import { SelectFilter } from "@/components/filters/SelectFilter";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { RelationFilterModal } from "@/components/filters/RelationFilterModal";
import { RelationFilterDropdown } from "@/components/filters/RelationFilterDropdown";
import { DebouncedInput } from "@/components/DebouncedInput";

/**
 * Validates and normalizes raw URL search parameters into a typed `BoxFilters` object.
 * `thingIds` is serialized as a comma-separated string in the URL and parsed by splitting.
 *
 * @see https://tanstack.com/router/latest/docs/framework/react/guide/search-params#validating-search-params
 */
function parseIdList(raw: unknown): number[] | undefined {
  if (typeof raw === "string" && raw.length > 0) {
    return raw.split(",").map(Number).filter((n) => !isNaN(n));
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
    oldItemId: typeof search.oldItemId === "number" ? search.oldItemId : undefined,
    oldThingIds: parseIdList(search.oldThingIds),
  };
}

/**
 * TanStack Router route definition for the "/box/" path.
 * - `validateSearch` — parses and validates URL search params on every navigation.
 * - `loaderDeps` — declares which search params the loader depends on so it re-runs when they change.
 * - `loader` — prefetches box data via the query client before the component renders,
 *   enabling instant page loads with `useSuspenseQuery`.
 *
 * @see https://tanstack.com/router/latest/docs/framework/react/guide/data-loading
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/suspense
 */
export const Route = createFileRoute("/box/")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(boxesQueryOptions(deps)),
  component: BoxPage,
});

/**
 * Typed column helper scoped to `BoxDto`.
 *
 * @see https://tanstack.com/table/latest/docs/guide/column-defs#creating-accessor-columns
 */
const columnHelper = createColumnHelper<BoxDto>();

/**
 * Column definitions for the boxes table.
 *
 * @see https://tanstack.com/table/latest/docs/guide/column-defs
 */
const columns = [
  columnHelper.accessor("id", { header: "ID", size: 60 }),
  columnHelper.accessor("name", { header: "Name", size: 200 }),
  columnHelper.accessor("objectCode", { header: "Object Code", size: 130 }),
  columnHelper.accessor("shape", { header: "Shape", size: 80 }),
  columnHelper.accessor("num", { header: "Num", size: 100 }),
  columnHelper.accessor("item", {
    header: "Item",
    size: 180,
    cell: (info) => info.getValue()?.name ?? "—",
  }),
  columnHelper.accessor("things", {
    header: "Things",
    size: 200,
    cell: (info) => {
      const things = info.getValue();
      return things && things.length > 0
        ? things.map((t) => t.name).join(", ")
        : "—";
    },
  }),
  columnHelper.accessor("oldItem", {
    header: "Old Item",
    size: 180,
    cell: (info) => info.getValue()?.name ?? "—",
  }),
  columnHelper.accessor("oldThings", {
    header: "Old Things",
    size: 200,
    cell: (info) => {
      const oldThings = info.getValue();
      return oldThings && oldThings.length > 0
        ? oldThings.map((t) => t.name).join(", ")
        : "—";
    },
  }),
  columnHelper.accessor("dateStr", { header: "Date", size: 120 }),
  columnHelper.accessor("checkbox", {
    header: "Checkbox",
    size: 90,
    cell: (info) => (info.getValue() ? "Yes" : "No"),
  }),
  columnHelper.accessor("tags", {
    header: "Tags",
    size: 200,
    cell: (info) => {
      const tags = info.getValue();
      return tags && tags.length > 0 ? tags.join(", ") : "—";
    },
  }),
];

/**
 * Column resize strategy.
 *
 * @see https://tanstack.com/table/latest/docs/guide/column-sizing#column-resize-mode
 */
const columnResizeMode: ColumnResizeMode = "onChange";

/**
 * Zod validation schema for inline-editing a box row.
 *
 * @see https://zod.dev/?id=strings
 */
const boxSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: z.string().nullable(),
  shape: z.enum(["O", "X"]),
  num: z.number(),
  dateStr: z.string(),
  checkbox: z.boolean(),
});

/**
 * Shape options for the filter and edit select.
 */
const itemColumns: ColumnDef<ItemDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "date", header: "Date" },
  { accessorKey: "count", header: "Count" },
];

const thingColumns: ColumnDef<ThingDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "date", header: "Date" },
  { accessorKey: "count", header: "Count" },
];

const shapeOptions = [
  { label: "O", value: "O" },
  { label: "X", value: "X" },
];

/**
 * Main page component for the Boxes list view.
 * Renders a filterable, paginated, inline-editable data table with server-side operations.
 */
function BoxPage() {
  // URL-synced filter state
  const { filters, setFilters, setPage } = useFilters("/box/");

  // Suspense-enabled query — data is guaranteed to be available on first render
  const { data } = useSuspenseQuery(boxesQueryOptions(filters));

  // Pagination
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const pageCount = Math.ceil(data.count / pageSize);

  // Fetch all items — needed for oldItem dropdown and label hydration
  const { data: allItems } = useQuery(itemsQueryOptions());

  // Fetch all things — needed for oldThings dropdown and label hydration
  const { data: allThings } = useQuery(thingsQueryOptions());

  // Modal filter state for RelationFilterModal instances
  const [itemModalFilters, setItemModalFilters] = useState<Record<string, unknown>>({});
  const [thingModalFilters, setThingModalFilters] = useState<Record<string, unknown>>({});

  // Server-filtered queries for modal data
  const { data: filteredItems, isFetching: isItemsLoading } = useQuery(
    itemsFilteredQueryOptions(itemModalFilters),
  );
  const { data: filteredThings, isFetching: isThingsLoading } = useQuery(
    thingsFilteredQueryOptions(thingModalFilters),
  );

  // Derive the selected ItemDto from URL-stored itemId
  const selectedItem = useMemo<ItemDto | undefined>(() => {
    if (filters.itemId === undefined || !allItems) return undefined;
    return allItems.data.find((i) => i.id === filters.itemId);
  }, [filters.itemId, allItems]);

  // Derive the selected ThingDto[] from URL-stored thingIds
  const selectedThings = useMemo<ThingDto[]>(() => {
    if (!filters.thingIds || filters.thingIds.length === 0 || !allThings)
      return [];
    const idSet = new Set(filters.thingIds);
    return allThings.data.filter((t) => idSet.has(t.id));
  }, [filters.thingIds, allThings]);

  // Derive the selected ItemDto from URL-stored oldItemId
  const selectedOldItem = useMemo<ItemDto | undefined>(() => {
    if (filters.oldItemId === undefined || !allItems) return undefined;
    return allItems.data.find((i) => i.id === filters.oldItemId);
  }, [filters.oldItemId, allItems]);

  // Derive the selected ThingDto[] from URL-stored oldThingIds
  const selectedOldThings = useMemo<ThingDto[]>(() => {
    if (!filters.oldThingIds || filters.oldThingIds.length === 0 || !allThings)
      return [];
    const idSet = new Set(filters.oldThingIds);
    return allThings.data.filter((t) => idSet.has(t.id));
  }, [filters.oldThingIds, allThings]);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  /**
   * TanStack Table instance configured for server-side operations.
   *
   * @see https://tanstack.com/table/latest/docs/guide/tables
   */
  const table = useReactTable({
    data: data.data,
    columns,
    columnResizeMode,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    rowCount: data.count,
    state: {
      columnVisibility,
      pagination: { pageIndex: page - 1, pageSize },
    },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const queryClient = useQueryClient();

  /**
   * Mutation for saving inline edits.
   *
   * @see https://tanstack.com/query/latest/docs/framework/react/guides/mutations
   */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BoxDto> }) =>
      patchBox(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
    },
  });

  /**
   * Inline edit configuration for the SimpleTable component.
   */
  const editConfig = useMemo<EditConfig<BoxDto>>(
    () => ({
      fields: {
        name: { type: "text" },
        objectCode: { type: "text" },
        shape: {
          type: "select",
          options: [
            { label: "O", value: "O" },
            { label: "X", value: "X" },
          ],
        },
        num: { type: "number" },
        dateStr: { type: "text" },
        checkbox: { type: "checkbox" },
      },
      disabledFields: ["id"],
      schema: boxSchema,
      onSave: async (id, data) => {
        await updateMutation.mutateAsync({ id: id as number, data });
      },
      rowId: (row) => row.id,
    }),
    [updateMutation],
  );

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Boxes</h1>
          <p className="mt-2 text-muted-foreground">{data.count} boxes</p>
        </div>
      </div>

      {/* Data table with server-side filtering, pagination, and inline editing */}
      <SimpleTable
        table={table}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        filterSlot={
          <FilterBar>
            {/* Row 1: name, objectCode, shape, checkbox */}
            <TextFilter
              placeholder="Name"
              value={filters.name}
              onChange={(value) => setFilters({ name: value })}
            />
            <TextFilter
              placeholder="Object Code"
              value={filters.objectCode}
              onChange={(value) => setFilters({ objectCode: value })}
            />
            <div className="grid grid-cols-2">
              <SelectFilter
                placeholder="Shape"
                options={shapeOptions}
                value={filters.shape}
                onChange={(value) =>
                  setFilters({ shape: value as "O" | "X" | undefined })
                }
              />
              <CheckboxFilter
                label="Checkbox"
                value={filters.checkbox}
                onChange={(value) => setFilters({ checkbox: value })}
              />
            </div>

            {/* Row 2: num range, tags, dateStr range (col-span-2) */}
            <NumberRangeFilter
              valueMin={filters.numMin}
              valueMax={filters.numMax}
              onChangeMin={(value) => setFilters({ numMin: value })}
              onChangeMax={(value) => setFilters({ numMax: value })}
              placeholderMin="Num Min"
              placeholderMax="Num Max"
            />
            <TextFilter
              placeholder="Tags"
              value={filters.tags}
              onChange={(value) => setFilters({ tags: value })}
            />
            <DateRangeFilter
              valueFrom={filters.dateStrFrom}
              valueTo={filters.dateStrTo}
              onChangeFrom={(value) => setFilters({ dateStrFrom: value })}
              onChangeTo={(value) => setFilters({ dateStrTo: value })}
              placeholderFrom="Date From"
              placeholderTo="Date To"
            />

            {/* Row 3: item (single, col-span-2), things (multi, col-span-2) */}
            <RelationFilterModal<ItemDto>
              multi={false}
              value={selectedItem}
              onChange={(val) => {
                const item = val as ItemDto | undefined;
                setFilters({ itemId: item?.id });
              }}
              data={filteredItems?.data ?? []}
              isLoading={isItemsLoading}
              getLabel={(item) => item.name}
              getId={(item) => item.id}
              placeholder="Item..."
              className="col-span-2"
              tableColumns={itemColumns}
              filterSlot={
                <div className="grid grid-cols-3 gap-2">
                  <DebouncedInput
                    placeholder="Name"
                    value={(itemModalFilters.name as string) ?? ""}
                    onChange={(v) =>
                      setItemModalFilters((prev) => ({ ...prev, name: v || undefined }))
                    }
                  />
                </div>
              }
            />
            <RelationFilterModal<ThingDto>
              multi={true}
              value={selectedThings}
              onChange={(val) => {
                const things = val as ThingDto[] | undefined;
                setFilters({
                  thingIds:
                    things && things.length > 0
                      ? things.map((t) => t.id)
                      : undefined,
                });
              }}
              data={filteredThings?.data ?? []}
              isLoading={isThingsLoading}
              getLabel={(thing) => thing.name}
              getId={(thing) => thing.id}
              placeholder="Things..."
              className="col-span-2"
              tableColumns={thingColumns}
              filterSlot={
                <div className="grid grid-cols-3 gap-2">
                  <DebouncedInput
                    placeholder="Name"
                    value={(thingModalFilters.name as string) ?? ""}
                    onChange={(v) =>
                      setThingModalFilters((prev) => ({ ...prev, name: v || undefined }))
                    }
                  />
                </div>
              }
            />
            {/* Row 4: oldItem (single, dropdown), oldThings (multi, dropdown) */}
            <RelationFilterDropdown<ItemDto>
              multi={false}
              value={selectedOldItem}
              onChange={(val) => {
                const item = val as ItemDto | undefined;
                setFilters({ oldItemId: item?.id });
              }}
              data={allItems?.data ?? []}
              getLabel={(item) => item.name}
              getId={(item) => item.id}
              placeholder="Old Item..."
              className="col-span-2"
            />
            <RelationFilterDropdown<ThingDto>
              multi={true}
              value={selectedOldThings}
              onChange={(val) => {
                const things = val as ThingDto[] | undefined;
                setFilters({
                  oldThingIds:
                    things && things.length > 0
                      ? things.map((t) => t.id)
                      : undefined,
                });
              }}
              data={allThings?.data ?? []}
              getLabel={(thing) => thing.name}
              getId={(thing) => thing.id}
              placeholder="Old Things..."
              className="col-span-2"
            />
          </FilterBar>
        }
        editConfig={editConfig}
        pinnedLeftColumnId="name"
      />
    </div>
  );
}
