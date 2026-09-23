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
  const columns = React.useMemo(
    () => getMicroserviceAtColumns({ pendingIds: new Set<number>() }),
    [],
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
