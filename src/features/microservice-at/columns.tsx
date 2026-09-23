import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Checkbox } from "@/components/ui/checkbox";
import { dash } from "@/lib/format";
import {
  ENVIRONMENTS,
  type Deployment,
  type Environment,
  type MicroserviceAtRow,
} from "./mappers";

interface GetMicroserviceAtColumnsProps {
  /** Absent → the Need AT checkbox is read-only. */
  onToggleNeedAT?: (id: number, isNeedAT: boolean) => void;
  /** True while that row's toggle is in flight; its checkbox is then
   *  disabled. A getter (not a `Set`) so `getMicroserviceAtColumns`'s result
   *  can stay referentially stable across pending-state changes: the caller
   *  passes a stable function that reads current state from a ref, instead
   *  of a new `Set` on every toggle. */
  isPending: (id: number) => boolean;
}

// Lowercase and called as a plain function (not used as a JSX tag), so this
// file has no unexported capitalized component alongside the exported
// column-factory function — that combination trips
// react-refresh/only-export-components.
function renderDeploymentCell(items: Deployment[]) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">{dash("")}</span>;
  }
  return (
    <ul className="space-y-0.5">
      {items.map((d, i) => (
        <li
          key={`${d.tc}|${d.artifact}|${d.version}|${i}`}
          className="whitespace-nowrap text-xs leading-5"
        >
          <span className="text-muted-foreground">{dash(d.tc)}:</span>{" "}
          <span className="font-mono">
            {dash(d.artifact)} - {dash(d.version)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function environmentColumn(env: Environment): ColumnDef<MicroserviceAtRow> {
  return {
    id: env.toLowerCase(),
    header: env,
    cell: ({ row }) => renderDeploymentCell(row.original.deployments[env]),
    meta: { label: env },
    enableSorting: false,
    size: 360,
  };
}

export function getMicroserviceAtColumns({
  onToggleNeedAT,
  isPending,
}: GetMicroserviceAtColumnsProps): ColumnDef<MicroserviceAtRow>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Microservice" />
      ),
      cell: ({ cell }) => (
        <span className="font-medium">{dash(cell.getValue<string>())}</span>
      ),
      meta: {
        label: "Microservice",
        placeholder: "Search microservices...",
        variant: "text",
        filterKey: "name",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: false,
      size: 300,
    },
    ...ENVIRONMENTS.map(environmentColumn),
    {
      id: "isNeedAT",
      header: "Need AT",
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Need AT for ${row.original.name}`}
          checked={row.original.data?.isNeedAT === true}
          disabled={!onToggleNeedAT || isPending(row.original.id)}
          onCheckedChange={(value) => onToggleNeedAT?.(row.original.id, value === true)}
        />
      ),
      meta: { label: "Need AT" },
      enableSorting: false,
      size: 90,
    },
    {
      // The AT link is not in the DB yet — placeholder until it is.
      id: "at",
      header: "AT",
      cell: () => <span className="text-muted-foreground">{dash("")}</span>,
      meta: { label: "AT" },
      enableSorting: false,
      size: 80,
    },
  ];
}
