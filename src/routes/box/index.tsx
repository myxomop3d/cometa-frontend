import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  type ColumnResizeMode,
  type VisibilityState,
} from "@tanstack/react-table";
import { z } from "zod";
import { boxesQueryOptions, patchBox } from "@/api/box";
import { fetchItems, itemsQueryOptions } from "@/api/item";
import { fetchThings, thingsQueryOptions } from "@/api/thing";
import type { BoxDto, BoxFilters, ItemDto, ThingDto } from "@/types/api";
import { SimpleTable } from "@/components/SimpleTable";
import { useFilters } from "@/hooks/useFilters";
import type { EditConfig } from "@/types/table";
import { FilterBar } from "@/components/filters/FilterBar";
import { TextFilter } from "@/components/filters/TextFilter";
import { NumberRangeFilter } from "@/components/filters/NumberRangeFilter";
import { CheckboxFilter } from "@/components/filters/CheckboxFilter";
import { SelectFilter } from "@/components/filters/SelectFilter";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { RelationFilter } from "@/components/filters/RelationFilter";

/**
 * Validates and normalizes raw URL search parameters into a typed `BoxFilters` object.
 * `thingIds` is serialized as a comma-separated string in the URL and parsed by splitting.
 *
 * @see https://tanstack.com/router/latest/docs/framework/react/guide/search-params#validating-search-params
 */
function validateSearch(search: Record<string, unknown>): BoxFilters {
  const rawThingIds = search.thingIds;
  let thingIds: number[] | undefined;
  if (typeof rawThingIds === "string" && rawThingIds.length > 0) {
    thingIds = rawThingIds.split(",").map(Number).filter((n) => !isNaN(n));
  } else if (Array.isArray(rawThingIds)) {
    thingIds = (rawThingIds as unknown[]).map(Number).filter((n) => !isNaN(n));
  }

  return {
    page:        typeof search.page        === "number" ? search.page        : 1,
    pageSize:    typeof search.pageSize    === "number" ? search.pageSize    : 20,
    name:        typeof search.name        === "string" ? search.name        : undefined,
    objectCode:  typeof search.objectCode  === "string" ? search.objectCode  : undefined,
    shape:       search.shape === "O" || search.shape === "X" ? search.shape : undefined,
    tags:        typeof search.tags        === "string" ? search.tags        : undefined,
    numMin:      typeof search.numMin      === "number" ? search.numMin      : undefined,
    numMax:      typeof search.numMax      === "number" ? search.numMax      : undefined,
    checkbox:    typeof search.checkbox    === "boolean" ? search.checkbox   : undefined,
    dateStrFrom: typeof search.dateStrFrom === "string" ? search.dateStrFrom : undefined,
    dateStrTo:   typeof search.dateStrTo   === "string" ? search.dateStrTo   : undefined,
    itemId:      typeof search.itemId      === "number" ? search.itemId      : undefined,
    thingIds,
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
  columnHelper.accessor("id",         { header: "ID",          size: 60  }),
  columnHelper.accessor("name",       { header: "Name",        size: 200 }),
  columnHelper.accessor("objectCode", { header: "Object Code", size: 130 }),
  columnHelper.accessor("shape",      { header: "Shape",       size: 80  }),
  columnHelper.accessor("num",        { header: "Num",         size: 100 }),
  columnHelper.accessor("item",       {
    header: "Item",
    size: 180,
    cell: (info) => info.getValue()?.name ?? "—",
  }),
  columnHelper.accessor("things",     {
    header: "Things",
    size: 200,
    cell: (info) => {
      const things = info.getValue();
      return things && things.length > 0 ? things.map((t) => t.name).join(", ") : "—";
    },
  }),
  columnHelper.accessor("dateStr",    { header: "Date",        size: 120 }),
  columnHelper.accessor("checkbox",   {
    header: "Checkbox",
    size: 90,
    cell: (info) => info.getValue() ? "Yes" : "No",
  }),
  columnHelper.accessor("tags",       {
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
  name:       z.string().min(1, "Name is required"),
  objectCode: z.string().nullable(),
  shape:      z.enum(["O", "X"]),
  num:        z.number(),
  dateStr:    z.string(),
  checkbox:   z.boolean(),
});

/**
 * Shape options for the filter and edit select.
 */
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
  const page      = filters.page     ?? 1;
  const pageSize  = filters.pageSize ?? 20;
  const pageCount = Math.ceil(data.count / pageSize);

  // Fetch all items when itemId filter is active (for label hydration on reload)
  const { data: allItems } = useQuery({
    ...itemsQueryOptions(),
    enabled: filters.itemId !== undefined,
  });

  // Fetch all things when thingIds filter is active (for label hydration on reload)
  const { data: allThings } = useQuery({
    ...thingsQueryOptions(),
    enabled: !!filters.thingIds && filters.thingIds.length > 0,
  });

  // Derive the selected ItemDto from URL-stored itemId
  const selectedItem = useMemo<ItemDto | undefined>(() => {
    if (filters.itemId === undefined || !allItems) return undefined;
    return allItems.data.find((i) => i.id === filters.itemId);
  }, [filters.itemId, allItems]);

  // Derive the selected ThingDto[] from URL-stored thingIds
  const selectedThings = useMemo<ThingDto[]>(() => {
    if (!filters.thingIds || filters.thingIds.length === 0 || !allThings) return [];
    const idSet = new Set(filters.thingIds);
    return allThings.data.filter((t) => idSet.has(t.id));
  }, [filters.thingIds, allThings]);

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
    manualFiltering:  true,
    manualPagination: true,
    manualSorting:    true,
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
        name:       { type: "text" },
        objectCode: { type: "text" },
        shape: {
          type: "select",
          options: [
            { label: "O", value: "O" },
            { label: "X", value: "X" },
          ],
        },
        num:      { type: "number" },
        dateStr:  { type: "text" },
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
            <SelectFilter
              placeholder="Shape"
              options={shapeOptions}
              value={filters.shape}
              onChange={(value) => setFilters({ shape: value as "O" | "X" | undefined })}
            />
            <CheckboxFilter
              label="Checkbox"
              value={filters.checkbox}
              onChange={(value) => setFilters({ checkbox: value })}
            />

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
              className="col-span-2"
            />

            {/* Row 3: item (single, col-span-2), things (multi, col-span-2) */}
            <RelationFilter<ItemDto>
              mode="both"
              multi={false}
              value={selectedItem}
              onChange={(val) => {
                const item = val as ItemDto | undefined;
                setFilters({ itemId: item?.id });
              }}
              queryFn={fetchItems}
              queryKey={["items", "all"]}
              getLabel={(item) => item.name}
              getId={(item) => item.id}
              placeholder="Item..."
              className="col-span-2"
            />
            <RelationFilter<ThingDto>
              mode="both"
              multi={true}
              value={selectedThings}
              onChange={(val) => {
                const things = val as ThingDto[] | undefined;
                setFilters({
                  thingIds: things && things.length > 0
                    ? things.map((t) => t.id)
                    : undefined,
                });
              }}
              queryFn={fetchThings}
              queryKey={["things", "all"]}
              getLabel={(thing) => thing.name}
              getId={(thing) => thing.id}
              placeholder="Things..."
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
