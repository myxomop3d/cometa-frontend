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
import { automatedSystemsFilteredQueryOptions } from "@/features/automated-system/api";
import type {
  AutomatedSystemDto,
  AutomatedSystemFlatDto,
  TechComponentDto,
} from "@/types/api";
import type { TechComponentRowAction } from "./row-action";
import { TECH_COMPONENT_ENVIRONMENTS } from "./schema";

interface GetTechComponentColumnsProps {
  setRowAction: React.Dispatch<
    React.SetStateAction<TechComponentRowAction | null>
  >;
}

const automatedSystemRelationColumns: ColumnDef<AutomatedSystemDto, unknown>[] = [
  { id: "name", accessorKey: "name", header: "Name" },
  { id: "ci", accessorKey: "ci", header: "CI" },
];

// Lowercase on purpose: a top-level PascalCase function declaration here
// trips eslint-plugin-react-refresh's only-export-components rule (this
// file's sole export, getTechComponentColumns, isn't itself a component), so
// this renders JSX via a plain call (`urlCell(value)`) rather than a `<Tag />`.
function urlCell(value: string | null | undefined) {
  if (!value) return <>{dash(value)}</>;
  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      {value}
    </a>
  );
}

function textColumn(
  id: "name" | "groupName" | "technology",
  label: string,
  placeholder: string,
  size: number,
): ColumnDef<TechComponentDto> {
  return {
    id,
    accessorKey: id,
    header: ({ column }) => <DataTableColumnHeader column={column} label={label} />,
    cell: ({ cell }) => dash(cell.getValue<string | null>()),
    meta: { label, placeholder, variant: "text", filterKey: id },
    enableColumnFilter: true,
    enableSorting: true,
    size,
  };
}

function urlColumn(
  id: "consoleUrl" | "infoUrl",
  label: string,
): ColumnDef<TechComponentDto> {
  return {
    id,
    accessorKey: id,
    header: ({ column }) => <DataTableColumnHeader column={column} label={label} />,
    cell: ({ cell }) => urlCell(cell.getValue<string | null>()),
    // Hidden by default via switchable-config's initialColumnVisibility.
    meta: { label },
    enableColumnFilter: false,
    enableSorting: true,
    size: 260,
  };
}

export function getTechComponentColumns({
  setRowAction,
}: GetTechComponentColumnsProps): ColumnDef<TechComponentDto>[] {
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
    textColumn("name", "Name", "Search names...", 220),
    textColumn("groupName", "Group", "Search groups...", 180),
    textColumn("technology", "Technology", "Search technologies...", 140),
    {
      id: "environment",
      accessorKey: "environment",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Environment" />
      ),
      cell: ({ cell }) => dash(cell.getValue<string | null>()),
      meta: {
        label: "Environment",
        variant: "select",
        options: TECH_COMPONENT_ENVIRONMENTS.map((e) => ({ label: e, value: e })),
        filterKey: "environment",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 130,
    },
    {
      id: "automatedSystem",
      accessorKey: "automatedSystem",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Automated System" />
      ),
      cell: ({ cell }) => {
        // Id 0 renders as its name, "Not set" — an ordinary row.
        const system = cell.getValue<AutomatedSystemFlatDto | null>();
        return system ? dash(system.name) : "—";
      },
      meta: {
        label: "Automated System",
        variant: "relation",
        filterKey: "automatedSystemId",
        relationConfig: {
          queryOptionsFn: (filters: Record<string, unknown>) =>
            automatedSystemsFilteredQueryOptions(filters),
          columns: automatedSystemRelationColumns,
          getLabel: (system: AutomatedSystemDto) => system.name,
          getId: (system: AutomatedSystemDto) => system.id,
        },
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 220,
    },
    urlColumn("consoleUrl", "Console URL"),
    urlColumn("infoUrl", "Info URL"),
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
