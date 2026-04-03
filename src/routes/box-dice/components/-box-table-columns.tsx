import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis } from "lucide-react";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoxDto, ItemDto, ThingDto } from "@/types/api";
import type { DataTableRowAction } from "@/types/data-table";
import { itemsFilteredQueryOptions } from "@/api/item";
import { thingsFilteredQueryOptions } from "@/api/thing";

const itemColumns: ColumnDef<ItemDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

const thingColumns: ColumnDef<ThingDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

interface GetBoxColumnsProps {
  setRowAction: React.Dispatch<
    React.SetStateAction<DataTableRowAction<BoxDto> | null>
  >;
}

export function getBoxColumns({
  setRowAction,
}: GetBoxColumnsProps): ColumnDef<BoxDto>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          className="translate-y-0.5"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          className="translate-y-0.5"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
      enableHiding: false,
      enableSorting: false,
      size: 40,
    },
    {
      id: "id",
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="ID" />
      ),
      enableSorting: true,
      enableHiding: false,
      size: 60,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Name" />
      ),
      meta: {
        label: "Name",
        placeholder: "Search names...",
        variant: "text",
        filterKey: "name",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 200,
    },
    {
      id: "objectCode",
      accessorKey: "objectCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Object Code" />
      ),
      meta: {
        label: "Object Code",
        placeholder: "Search codes...",
        variant: "text",
        filterKey: "objectCode",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 130,
    },
    {
      id: "shape",
      accessorKey: "shape",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Shape" />
      ),
      meta: {
        label: "Shape",
        variant: "select",
        options: [
          { label: "O", value: "O" },
          { label: "X", value: "X" },
        ],
        filterKey: "shape",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 80,
    },
    {
      id: "num",
      accessorKey: "num",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Num" />
      ),
      meta: {
        label: "Num",
        variant: "range",
        range: [0, 1000],
        filterKeys: ["numMin", "numMax"],
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 100,
    },
    {
      id: "item",
      accessorKey: "item",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Item" />
      ),
      cell: ({ cell }) => cell.getValue<ItemDto | null>()?.name ?? "—",
      meta: {
        label: "Item",
        variant: "relation",
        filterKey: "itemId",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            itemsFilteredQueryOptions(filters),
          columns: itemColumns,
          getLabel: (item: ItemDto) => item.name,
          getId: (item: ItemDto) => item.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 180,
    },
    {
      id: "things",
      accessorKey: "things",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Things" />
      ),
      cell: ({ cell }) => {
        const things = cell.getValue<ThingDto[] | null>();
        return things && things.length > 0
          ? things.map((t) => t.name).join(", ")
          : "—";
      },
      meta: {
        label: "Things",
        variant: "multiRelation",
        filterKey: "thingIds",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            thingsFilteredQueryOptions(filters),
          columns: thingColumns,
          getLabel: (thing: ThingDto) => thing.name,
          getId: (thing: ThingDto) => thing.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 200,
    },
    {
      id: "oldItem",
      accessorKey: "oldItem",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Old Item" />
      ),
      cell: ({ cell }) => cell.getValue<ItemDto | null>()?.name ?? "—",
      meta: {
        label: "Old Item",
        variant: "relation",
        filterKey: "oldItemId",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            itemsFilteredQueryOptions(filters),
          columns: itemColumns,
          getLabel: (item: ItemDto) => item.name,
          getId: (item: ItemDto) => item.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 180,
    },
    {
      id: "oldThings",
      accessorKey: "oldThings",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Old Things" />
      ),
      cell: ({ cell }) => {
        const oldThings = cell.getValue<ThingDto[] | null>();
        return oldThings && oldThings.length > 0
          ? oldThings.map((t) => t.name).join(", ")
          : "—";
      },
      meta: {
        label: "Old Things",
        variant: "multiRelation",
        filterKey: "oldThingIds",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            thingsFilteredQueryOptions(filters),
          columns: thingColumns,
          getLabel: (thing: ThingDto) => thing.name,
          getId: (thing: ThingDto) => thing.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 200,
    },
    {
      id: "dateStr",
      accessorKey: "dateStr",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Date" />
      ),
      meta: {
        label: "Date",
        variant: "dateRange",
        filterKeys: ["dateStrFrom", "dateStrTo"],
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 120,
    },
    {
      id: "checkbox",
      accessorKey: "checkbox",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Checkbox" />
      ),
      cell: ({ cell }) => (cell.getValue<boolean>() ? "Yes" : "No"),
      meta: {
        label: "Checkbox",
        variant: "boolean",
        filterKey: "checkbox",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 90,
    },
    {
      id: "tags",
      accessorKey: "tags",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Tags" />
      ),
      cell: ({ cell }) => {
        const tags = cell.getValue<string[]>();
        return tags && tags.length > 0 ? tags.join(", ") : "—";
      },
      meta: {
        label: "Tags",
        placeholder: "Search tags...",
        variant: "text",
        filterKey: "tags",
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 200,
    },
    {
      id: "actions",
      cell: function Cell({ row }) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                className="flex size-8 p-0"
              >
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onSelect={() => setRowAction({ row, variant: "update" })}
              >
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 40,
    },
  ];
}
