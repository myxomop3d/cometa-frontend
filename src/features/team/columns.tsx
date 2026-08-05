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
import { personsFilteredQueryOptions } from "@/features/person/api";
import { personLabel } from "@/features/person/label";
import type { PersonDto, TeamDto } from "@/types/api";
import type { TeamRowAction } from "./row-action";

interface GetTeamColumnsProps {
  setRowAction: React.Dispatch<React.SetStateAction<TeamRowAction | null>>;
}

const personRelationColumns: ColumnDef<PersonDto, unknown>[] = [
  { id: "lastName", accessorKey: "lastName", header: "Last Name" },
  { id: "firstName", accessorKey: "firstName", header: "First Name" },
  { id: "email", accessorKey: "email", header: "Email" },
];

export function getTeamColumns({
  setRowAction,
}: GetTeamColumnsProps): ColumnDef<TeamDto>[] {
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
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Name" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Name",
        placeholder: "Search names...",
        variant: "text",
        filterKey: "name",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 240,
    },
    {
      id: "code",
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Code" />
      ),
      cell: ({ cell }) => cell.getValue<number | null>() ?? "—",
      meta: {
        label: "Code",
        variant: "range",
        range: [0, 10000],
        filterKeys: ["codeMin", "codeMax"],
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 100,
    },
    {
      id: "type",
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Type" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Type",
        variant: "select",
        options: [
          { label: "CHANGE", value: "CHANGE" },
          { label: "RUN", value: "RUN" },
        ],
        filterKey: "type",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 120,
    },
    {
      id: "leader",
      accessorKey: "leader",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader" />
      ),
      cell: ({ cell }) => {
        const leader = cell.getValue<PersonDto | null>();
        return leader ? personLabel(leader) : "—";
      },
      meta: {
        label: "Leader",
        variant: "relation",
        filterKey: "leaderId",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            personsFilteredQueryOptions(filters),
          columns: personRelationColumns,
          getLabel: (person: PersonDto) => personLabel(person),
          getId: (person: PersonDto) => person.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 220,
    },
    {
      id: "leaderRole",
      accessorKey: "leaderRole",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader Role" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Leader Role",
        placeholder: "Search leader roles...",
        variant: "text",
        filterKey: "leaderRole",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 160,
    },
    {
      id: "structure",
      accessorKey: "structure",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Structure" />
      ),
      cell: ({ cell }) => cell.getValue<string | null>() ?? "—",
      meta: {
        label: "Structure",
        placeholder: "Search structures...",
        variant: "text",
        filterKey: "structure",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
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
