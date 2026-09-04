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
import { automatedSystemSwitchableConfig } from "@/features/automated-system/switchable-config";
import { validateAutomatedSystemSearchFields } from "./-simple-search";
import { AutomatedSystemSheet } from "@/features/automated-system/components/AutomatedSystemSheet";

export const Route = createFileRoute("/automated-system/")({
  // `validateAutomatedSystemSearchFields` carries the simple filter fields plus
  // the guard that keeps an unsortable column (`guid`) out of `$orderby` even
  // when it arrives from a hand-edited or bookmarked URL. The generic call must
  // stay inline: binding or wrapping it changes what TanStack infers as this
  // route's required search params — see the note on that function.
  validateSearch: makeSwitchableSearch(validateAutomatedSystemSearchFields),
  loaderDeps: ({ search }) => search,
  loader: makeSwitchableLoader(automatedSystemSwitchableConfig),
  component: AutomatedSystemPage,
});

function AutomatedSystemPage() {
  // Making `loaderDeps`/`loader` type-check forces TanStack to widen this
  // route's inferred search schema to `{}`; the runtime value is the validated
  // search, so assert it back to the shared switchable-search shape. Type-only.
  const search = Route.useSearch() as SwitchableSearchBase &
    Record<string, unknown>;
  const navigate = useNavigate({ from: "/automated-system/" });
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
    config: automatedSystemSwitchableConfig,
    search,
    navigate,
  });

  const handleSheetSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: automatedSystemSwitchableConfig.queryKey,
    });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetSystem = rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  const actions = (
    <>
      <AdvancedFilterToggle advanced={advanced} onToggle={toggleMode} />
      <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
        <Plus className="mr-1 size-4" />
        Add Automated System
      </Button>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automated Systems</h1>
          <p className="mt-2 text-muted-foreground">{count} systems</p>
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
        <AutomatedSystemSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          automatedSystem={sheetSystem}
          variant={sheetVariant}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}
