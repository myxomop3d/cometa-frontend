import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { DEFAULT_PAGE_SIZE } from "@/lib/data-table/switchable-page";
import { microserviceAtApi } from "@/features/microservice-at/api";
import { getMicroserviceAtColumns } from "@/features/microservice-at/columns";
import { toMicroserviceAtRow } from "@/features/microservice-at/mappers";
import { useToggleNeedAT } from "@/features/microservice-at/use-toggle-need-at";
import {
  deriveColumnFilters,
  validateMicroserviceAtSearch,
  type MicroserviceAtSearch,
} from "@/features/microservice-at/search";

function tableQueryOptions(search: MicroserviceAtSearch) {
  return microserviceAtApi.dataTableQueryOptions({
    page: search.page,
    pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
    sort: search.sort,
    columnFilters: deriveColumnFilters(search),
  });
}

export const Route = createFileRoute("/microservice-at/")({
  validateSearch: validateMicroserviceAtSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(tableQueryOptions(deps)),
  component: MicroserviceAtPage,
});

function MicroserviceAtPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/microservice-at/" });
  const { data } = useSuspenseQuery(tableQueryOptions(search));

  const rows = React.useMemo(() => data.data.map(toMicroserviceAtRow), [data.data]);
  const { toggle, isPending } = useToggleNeedAT();
  // `toggle` and `isPending` are both referentially stable (see
  // use-toggle-need-at.ts), so this memo — and the `columns` array it
  // produces — stays stable across a toggle's pending-state changes. That
  // matters because `useDataTable`'s `urlColumnFilters` depends on `columns`
  // and resets local column filters when it changes; a new array on every
  // toggle would wipe an in-progress, not-yet-debounced name search. The
  // checkbox still reflects pending state correctly: toggling updates state
  // inside `useToggleNeedAT`, which re-renders this component and (since
  // `DataTable` is a plain, unmemoized component) re-renders the table body,
  // so each cell's `isPending(id)` call reads the current ref value even
  // though `columns` itself never changed.
  const columns = React.useMemo(
    () => getMicroserviceAtColumns({ onToggleNeedAT: toggle, isPending }),
    [toggle, isPending],
  );

  const onNavigate = React.useCallback(
    (updates: Partial<MicroserviceAtSearch>) => {
      navigate({
        search: (prev) => validateMicroserviceAtSearch({ ...prev, ...updates }),
      });
    },
    [navigate],
  );

  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
  const { table } = useDataTable({
    columns,
    data: rows,
    pageCount: Math.ceil(data.count / pageSize),
    search,
    onNavigate,
    initialColumnPinning: { left: ["name"] },
  });

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold">Microservices &amp; AT</h1>
        <p className="mt-2 text-muted-foreground">{data.count} microservices</p>
      </div>

      <DataTable table={table}>
        <DataTableToolbar table={table} />
      </DataTable>
    </div>
  );
}
