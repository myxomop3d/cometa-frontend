import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis } from "lucide-react";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FlowDto } from "@/types/api";
import type { FlowRowAction } from "./row-action";

interface GetFlowColumnsProps {
  setRowAction: React.Dispatch<React.SetStateAction<FlowRowAction | null>>;
}

export function getFlowColumns({
  setRowAction,
}: GetFlowColumnsProps): ColumnDef<FlowDto>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          className="translate-y-0.5"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
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
      id: "code",
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Code" />
      ),
      meta: {
        label: "Code",
        placeholder: "Search codes...",
        variant: "text",
        filterKey: "code",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 250,
    },
    {
      id: "caption",
      accessorKey: "caption",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Caption" />
      ),
      meta: {
        label: "Caption",
        placeholder: "Search captions...",
        variant: "text",
        filterKey: "caption",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 300,
    },
    {
      id: "integrity",
      accessorKey: "integrity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Integrity" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Integrity",
        variant: "select",
        options: [
          { label: "I_1", value: "I_1" },
          { label: "I_2", value: "I_2" },
          { label: "I_3", value: "I_3" },
          { label: "I_4", value: "I_4" },
        ],
        filterKey: "integrity",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 100,
    },
    {
      id: "confidentiality",
      accessorKey: "confidentiality",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Confidentiality" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Confidentiality",
        variant: "select",
        options: [
          { label: "K_1", value: "K_1" },
          { label: "K_2", value: "K_2" },
          { label: "K_3", value: "K_3" },
          { label: "K_4", value: "K_4" },
        ],
        filterKey: "confidentiality",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 130,
    },
    {
      id: "dataClass",
      accessorKey: "dataClass",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Data Class" />
      ),
      meta: {
        label: "Data Class",
        variant: "select",
        options: [
          { label: "Client Data", value: "Client Data" },
          { label: "Static Data", value: "Static Data" },
          { label: "Market Data", value: "Market Data" },
          { label: "System Data", value: "System Data" },
          { label: "Technical Data", value: "Technical Data" },
          { label: "Trades", value: "Trades" },
          { label: "Instruments", value: "Instruments" },
          { label: "Analytics Data", value: "Analytics Data" },
          { label: "Other", value: "Other" },
        ],
        filterKey: "dataClass",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 140,
    },
    {
      id: "dataType",
      accessorKey: "dataType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Data Type" />
      ),
      meta: {
        label: "Data Type",
        placeholder: "Search data types...",
        variant: "text",
        filterKey: "dataType",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 200,
    },
    {
      id: "secretClass",
      accessorKey: "secretClass",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Secret Class" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      enableSorting: true,
      size: 120,
    },
    {
      id: "actions",
      cell: function Cell({ row }) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open menu"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "flex size-8 p-0",
              )}
            >
              <Ellipsis className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() =>
                  setRowAction({ variant: "update", row: row.original })
                }
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
