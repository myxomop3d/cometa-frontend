import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { SquareArrowRightEnter, SquareArrowRightExit } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { dash } from "@/lib/format";
import {
  ENVIRONMENTS,
  isEnvironment,
  type MicroserviceDeployment,
  type MicroserviceFlow,
  type MicroserviceOverviewDto,
  type MicroserviceTopic,
} from "./types";

// Lowercase helpers called as plain functions (not JSX tags), so this file
// exports only the column factory — see react-refresh/only-export-components.

function renderEmpty() {
  return <span className="text-muted-foreground">{dash("")}</span>;
}

function renderDeployments(items: MicroserviceDeployment[]) {
  if (items.length === 0) return renderEmpty();
  return (
    <ul className="space-y-0.5">
      {items.map((d, i) => (
        <li
          key={`${d.techComponentId}|${d.artifactId}|${d.version}|${i}`}
          className="whitespace-nowrap text-xs leading-5"
        >
          <span className="text-muted-foreground">{dash(d.techComponentName)}:</span>{" "}
          <span className="font-mono">
            {dash(d.artifactId)} - {dash(d.version)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Icons are drawn from the TOPIC's point of view: a message produced by the
 *  microservice enters the topic; a consumed one exits it. */
function renderTopicIcon(direction: MicroserviceTopic["direction"]) {
  if (direction === "PRODUCE") {
    return (
      <SquareArrowRightEnter
        className="size-3.5 shrink-0 text-red-600"
        aria-label="produces"
      >
        <title>produces</title>
      </SquareArrowRightEnter>
    );
  }
  return (
    <SquareArrowRightExit
      className="size-3.5 shrink-0 text-green-600"
      aria-label="consumes"
    >
      <title>consumes</title>
    </SquareArrowRightExit>
  );
}

function renderTopics(items: MicroserviceTopic[]) {
  if (items.length === 0) return renderEmpty();
  return (
    <ul className="space-y-0.5">
      {items.map((t) => (
        <li
          key={`${t.id}|${t.direction}`}
          className="flex items-center gap-1.5 whitespace-nowrap text-xs leading-5"
        >
          {renderTopicIcon(t.direction)}
          <span className="font-mono">{dash(t.name)}</span>
        </li>
      ))}
    </ul>
  );
}

function renderFlows(items: MicroserviceFlow[], environment: string) {
  if (items.length === 0) return renderEmpty();
  // flow-graph's `env` defaults to PROD; pass the row's env only when it is
  // one the route accepts, so an unexpected DB value can't break the link.
  const env = isEnvironment(environment) ? environment : undefined;
  return (
    <ul className="space-y-0.5">
      {items.map((f) => (
        <li key={f.id} className="text-xs leading-5">
          <Link
            to="/flow-graph"
            search={{ flowId: f.id, env }}
            className="underline-offset-2 hover:underline"
          >
            {dash(f.caption)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function getMicroserviceColumns(): ColumnDef<MicroserviceOverviewDto>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Microservice" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{dash(row.original.name)}</span>
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
    {
      id: "environment",
      accessorKey: "environment",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Env" />,
      cell: ({ row }) => (
        <Badge variant="outline">{dash(row.original.environment)}</Badge>
      ),
      meta: {
        label: "Env",
        variant: "multiSelect",
        options: ENVIRONMENTS.map((env) => ({ label: env, value: env })),
        filterKey: "env",
      },
      enableColumnFilter: true,
      enableSorting: true,
      size: 90,
    },
    {
      id: "deployments",
      accessorFn: (row) => row.deployments,
      header: "Deployments",
      cell: ({ row }) => renderDeployments(row.original.deployments),
      meta: {
        label: "artifactId",
        placeholder: "artifactId...",
        variant: "text",
        filterKey: "artifactId",
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 380,
    },
    {
      id: "topics",
      accessorFn: (row) => row.topics,
      header: "Topics",
      cell: ({ row }) => renderTopics(row.original.topics),
      meta: {
        label: "Topic",
        placeholder: "Topic...",
        variant: "text",
        filterKey: "topic",
      },
      enableColumnFilter: true,
      enableSorting: false,
      size: 340,
    },
    {
      id: "flows",
      header: "Flows",
      cell: ({ row }) => renderFlows(row.original.flows, row.original.environment),
      meta: { label: "Flows" },
      enableSorting: false,
      size: 300,
    },
  ];
}
