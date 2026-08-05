import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { AdvancedFilterToggle } from "@/components/data-table/advanced-filter-toggle";
import { Button } from "@/components/ui/button";

import { makeSwitchableSearch } from "@/lib/data-table/switchable-search";
import type { SwitchableSearchBase } from "@/lib/data-table/switchable-search";
import { makeSwitchableLoader } from "@/lib/data-table/switchable-page";
import { useSwitchableTablePage } from "@/hooks/use-switchable-table-page";
import { personSwitchableConfig } from "@/features/person/switchable-config";
import { validatePersonSimpleFields } from "./-simple-search";
import { PersonSheet } from "@/features/person/components/PersonSheet";

export const Route = createFileRoute("/person/")({
  validateSearch: makeSwitchableSearch(validatePersonSimpleFields),
  loaderDeps: ({ search }) => search,
  loader: makeSwitchableLoader(personSwitchableConfig),
  component: PersonPage,
});

function PersonPage() {
  // Making `loaderDeps`/`loader` type-check forces TanStack to widen this
  // route's inferred search schema to `{}`; the runtime value is the validated
  // search, so assert it back to the shared switchable-search shape. Type-only.
  const search = Route.useSearch() as SwitchableSearchBase &
    Record<string, unknown>;
  const navigate = useNavigate({ from: "/person/" });
  const queryClient = useQueryClient();

  const {
    table,
    advanced,
    count,
    rowAction,
    setRowAction,
    toggleMode,
    handleFilterChange,
  } = useSwitchableTablePage({
    config: personSwitchableConfig,
    search,
    navigate,
  });

  const handleSheetSuccess = () => {
    queryClient.invalidateQueries({ queryKey: personSwitchableConfig.queryKey });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetPerson = rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  const actions = (
    <>
      <AdvancedFilterToggle advanced={advanced} onToggle={toggleMode} />
      <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
        <Plus className="mr-1 size-4" />
        Add Person
      </Button>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Persons</h1>
          <p className="mt-2 text-muted-foreground">{count} persons</p>
        </div>
      </div>

      <DataTable table={table}>
        {advanced ? (
          <DataTableAdvancedToolbar
            table={table}
            filters={search.filters}
            joinOperator={search.joinOperator}
            onChange={handleFilterChange}
          >
            {actions}
          </DataTableAdvancedToolbar>
        ) : (
          <DataTableToolbar table={table}>{actions}</DataTableToolbar>
        )}
      </DataTable>

      {sheetOpen && (
        <PersonSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          person={sheetPerson}
          variant={sheetVariant}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}
