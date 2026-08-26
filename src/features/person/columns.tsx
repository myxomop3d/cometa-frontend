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
import { teamsFilteredQueryOptions } from "@/features/team/api";
import type { PersonDto, TeamDto } from "@/types/api";
import type { PersonRowAction } from "./row-action";

interface GetPersonColumnsProps {
  setRowAction: React.Dispatch<React.SetStateAction<PersonRowAction | null>>;
}

const teamRelationColumns: ColumnDef<TeamDto, unknown>[] = [
  { accessorKey: "id", header: "ID", size: 80 },
  { accessorKey: "name", header: "Name" },
];

export function getPersonColumns({
  setRowAction,
}: GetPersonColumnsProps): ColumnDef<PersonDto>[] {
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
      id: "email",
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Email" />
      ),
      meta: {
        label: "Email",
        placeholder: "Search emails...",
        variant: "text",
        filterKey: "email",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 260,
    },
    {
      id: "lastName",
      accessorKey: "lastName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Last Name" />
      ),
      meta: {
        label: "Last Name",
        placeholder: "Search last names...",
        variant: "text",
        filterKey: "lastName",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
    },
    {
      id: "firstName",
      accessorKey: "firstName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="First Name" />
      ),
      meta: {
        label: "First Name",
        placeholder: "Search first names...",
        variant: "text",
        filterKey: "firstName",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
    },
    {
      id: "middleName",
      accessorKey: "middleName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Middle Name" />
      ),
      meta: {
        label: "Middle Name",
        placeholder: "Search middle names...",
        variant: "text",
        filterKey: "middleName",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
    },
    {
      // Filter-only: no PersonDto.teams display field is wired up (see
      // task-4 scope — the Teams display column was deliberately deferred to
      // avoid triggering Hibernate in-memory pagination on every Person list
      // request). This column exists solely to host the team-membership
      // filter picker in the toolbar. Three mechanisms keep it functional
      // but invisible: the accessorFn below, `enableHiding: false` below,
      // and `initialColumnVisibility` in switchable-config.ts.
      id: "teams",
      // 1. accessorFn: TanStack's `getCanFilter()` requires a truthy
      // accessorFn before the simple-mode toolbar will render a filter
      // widget for a column at all. There's no PersonDto.teams field to key
      // off of, so this synthetic accessor exists purely to satisfy that
      // check; it intentionally always returns undefined since there's
      // nothing to display.
      accessorFn: () => undefined,
      header: "Teams",
      meta: {
        label: "Teams",
        variant: "multiRelation",
        filterKey: "teamIds",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            teamsFilteredQueryOptions(filters),
          columns: teamRelationColumns,
          getLabel: (team: TeamDto) => team.name ?? String(team.id),
          getId: (team: TeamDto) => team.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: false,
      // 2. enableHiding: false — now that the column has an accessorFn
      // (above), this is the sole reason it's excluded from the View
      // Options dropdown (data-table-view-options.tsx filters on accessorFn
      // presence AND getCanHide()). Removing this exposes a blank "Teams"
      // toggle. 3. initialColumnVisibility in switchable-config.ts is what
      // hides the column from the table body initially.
      enableHiding: false,
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
