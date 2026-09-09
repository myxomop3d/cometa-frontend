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
import { dash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { personsFilteredQueryOptions } from "@/features/person/api";
import { personLabel } from "@/features/person/label";
import type { AutomatedSystemDto, PersonDto, PersonFlatDto } from "@/types/api";
import type { AutomatedSystemRowAction } from "./row-action";

interface GetAutomatedSystemColumnsProps {
  setRowAction: React.Dispatch<
    React.SetStateAction<AutomatedSystemRowAction | null>
  >;
}

const personRelationColumns: ColumnDef<PersonDto, unknown>[] = [
  { id: "lastName", accessorKey: "lastName", header: "Last Name" },
  { id: "firstName", accessorKey: "firstName", header: "First Name" },
  { id: "email", accessorKey: "email", header: "Email" },
];

export function getAutomatedSystemColumns({
  setRowAction,
}: GetAutomatedSystemColumnsProps): ColumnDef<AutomatedSystemDto>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          className="translate-y-0.5"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
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
      header: ({ column }) => <DataTableColumnHeader column={column} label="ID" />,
      enableSorting: true,
      enableHiding: false,
      size: 60,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Name" />,
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
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
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: { label: "Object Code" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 130,
    },
    {
      id: "fullName",
      accessorKey: "fullName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Full Name" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: { label: "Full Name" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 250,
    },
    {
      id: "ci",
      accessorKey: "ci",
      header: ({ column }) => <DataTableColumnHeader column={column} label="CI" />,
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: {
        label: "CI",
        placeholder: "Search CIs...",
        variant: "text",
        filterKey: "ci",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 120,
    },
    {
      id: "nameHpsm",
      accessorKey: "nameHpsm",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="HPSM Name" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: { label: "HPSM Name" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 150,
    },
    {
      id: "leader",
      accessorKey: "leader",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader" />
      ),
      cell: ({ cell }) => {
        const leader = cell.getValue<PersonFlatDto | null>();
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
      id: "leaderComment",
      accessorKey: "leaderComment",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader (text)" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: {
        label: "Leader (text)",
        placeholder: "Search leader text...",
        variant: "text",
        filterKey: "leaderComment",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 180,
    },
    {
      id: "leaderSapId",
      accessorKey: "leaderSapId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Leader SAP ID" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: { label: "Leader SAP ID" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 140,
    },
    {
      id: "block",
      accessorKey: "block",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Block" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: {
        label: "Block",
        placeholder: "Search blocks...",
        variant: "text",
        filterKey: "block",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
    },
    {
      id: "tribe",
      accessorKey: "tribe",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Tribe" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: {
        label: "Tribe",
        placeholder: "Search tribes...",
        variant: "text",
        filterKey: "tribe",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
    },
    {
      id: "cluster",
      accessorKey: "cluster",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Cluster" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: {
        label: "Cluster",
        placeholder: "Search clusters...",
        variant: "text",
        filterKey: "cluster",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 150,
    },
    {
      id: "clusterHpsmId",
      accessorKey: "clusterHpsmId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Cluster HPSM ID" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: { label: "Cluster HPSM ID" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 150,
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Status" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: {
        label: "Status",
        variant: "select",
        // The only two values that occur across all 200 live rows
        // (181 / 17, plus 2 nulls). Verified 2026-09-04.
        options: [
          { label: "Находится в эксплуатации", value: "Находится в эксплуатации" },
          { label: "Выведен из эксплуатации", value: "Выведен из эксплуатации" },
        ],
        filterKey: "status",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 200,
    },
    {
      id: "iftMailSupport",
      accessorKey: "iftMailSupport",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="IFT Mail" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: { label: "IFT Mail" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 200,
    },
    {
      id: "uatMailSupport",
      accessorKey: "uatMailSupport",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="UAT Mail" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: { label: "UAT Mail" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 200,
    },
    {
      id: "prodMailSupport",
      accessorKey: "prodMailSupport",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Prod Mail" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: { label: "Prod Mail" },
      enableColumnFilter: false,
      enableSorting: true,
      size: 200,
    },
    {
      id: "guid",
      accessorKey: "guid",
      header: ({ column }) => <DataTableColumnHeader column={column} label="GUID" />,
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      // Hidden by default via switchable-config's initialColumnVisibility.
      meta: { label: "GUID" },
      enableColumnFilter: false,
      // NOT sortable: `guid` is a reserved literal token in odata-mini's
      // $orderby grammar (case-insensitively — `guid`, `Guid` and `GUID` all
      // hit it), so `$orderby=guid asc` is an ANTLR parse error, not a
      // field lookup. The backend answers 500 and the route's error boundary
      // replaces the whole table. Unlike an unknown field, no
      // `throw-on-field-not-found` setting can rescue it. Verified live
      // 2026-09-05 against odata-mini 2.2.0.
      enableSorting: false,
      size: 280,
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
                onClick={() => setRowAction({ variant: "update", row: row.original })}
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
