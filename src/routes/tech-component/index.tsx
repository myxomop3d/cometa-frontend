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
import { techComponentSwitchableConfig } from "@/features/tech-component/switchable-config";
import { TechComponentSheet } from "@/features/tech-component/components/TechComponentSheet";
import { validateTechComponentSimpleFields } from "./-simple-search";

export const Route = createFileRoute("/tech-component/")({
  // The generic call must stay inline: binding or wrapping it changes what
  // TanStack infers as this route's required search params.
  validateSearch: makeSwitchableSearch(validateTechComponentSimpleFields),
  loaderDeps: ({ search }) => search,
  loader: makeSwitchableLoader(techComponentSwitchableConfig),
  component: TechComponentPage,
});

function TechComponentPage() {
  // See the same assertion in routes/automated-system/index.tsx. Type-only.
  const search = Route.useSearch() as SwitchableSearchBase &
    Record<string, unknown>;
  const navigate = useNavigate({ from: "/tech-component/" });
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
    config: techComponentSwitchableConfig,
    search,
    navigate,
  });

  const handleSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: techComponentSwitchableConfig.queryKey,
    });
    setRowAction(null);
  };

  const sheetOpen = rowAction !== null;
  const sheetKey =
    rowAction?.variant === "update" ? `update-${rowAction.row.id}` : "create";
  const sheetComponent = rowAction?.variant === "update" ? rowAction.row : null;
  const sheetVariant: "update" | "create" =
    rowAction?.variant === "update" ? "update" : "create";

  const actions = (
    <>
      <AdvancedFilterToggle advanced={advanced} onToggle={toggleMode} />
      <Button size="sm" onClick={() => setRowAction({ variant: "create" })}>
        <Plus className="mr-1 size-4" />
        Add Tech Component
      </Button>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tech Components</h1>
          <p className="mt-2 text-muted-foreground">{count} components</p>
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
        <TechComponentSheet
          key={sheetKey}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setRowAction(null);
          }}
          techComponent={sheetComponent}
          variant={sheetVariant}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
