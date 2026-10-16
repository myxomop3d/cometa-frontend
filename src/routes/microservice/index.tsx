import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { DEFAULT_PAGE_SIZE } from "@/lib/data-table/switchable-page";
import { microserviceQueryOptions } from "@/features/microservice/api";
import { getMicroserviceColumns } from "@/features/microservice/columns";
import {
  validateMicroserviceSearch,
  type MicroserviceSearch,
} from "@/features/microservice/search";

function tableQueryOptions(search: MicroserviceSearch) {
  return microserviceQueryOptions(search, search.pageSize ?? DEFAULT_PAGE_SIZE);
}

export const Route = createFileRoute("/microservice/")({
  validateSearch: validateMicroserviceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(tableQueryOptions(deps)),
  component: MicroservicePage,
});

function MicroservicePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/microservice/" });
  const { data } = useSuspenseQuery(tableQueryOptions(search));

  // Built once: a new `columns` array would reset useDataTable's local column
  // filters and wipe a not-yet-debounced search.
  const columns = React.useMemo(() => getMicroserviceColumns(), []);

  const onNavigate = React.useCallback(
    (updates: Partial<MicroserviceSearch>) => {
      navigate({
        search: (prev) => validateMicroserviceSearch({ ...prev, ...updates }),
      });
    },
    [navigate],
  );

  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
  const { table } = useDataTable({
    columns,
    data: data.data,
    pageCount: Math.ceil(data.count / pageSize),
    search,
    onNavigate,
    initialColumnPinning: { left: ["name"] },
  });

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold">Микросервисы</h1>
        <p className="mt-2 text-muted-foreground">Всего: {data.count}</p>
      </div>

      <DataTable table={table}>
        <DataTableToolbar table={table} />
      </DataTable>
    </div>
  );
}
