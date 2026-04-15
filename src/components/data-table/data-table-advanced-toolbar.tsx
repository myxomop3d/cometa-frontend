import * as React from "react";
import type { Table } from "@tanstack/react-table";

import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { DataTableFilterList } from "@/components/data-table/data-table-filter-list";
import type { ExtendedColumnFilter } from "@/types/data-table";

export interface DataTableAdvancedToolbarProps<TData> {
  table: Table<TData>;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
  onChange: (next: {
    filters: ExtendedColumnFilter[];
    joinOperator: "and" | "or";
  }) => void;
  children?: React.ReactNode;
}

export function DataTableAdvancedToolbar<TData>({
  table,
  filters,
  joinOperator,
  onChange,
  children,
}: DataTableAdvancedToolbarProps<TData>) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2">
        <DataTableFilterList
          table={table}
          filters={filters}
          joinOperator={joinOperator}
          onChange={onChange}
        />
      </div>
      <div className="flex items-center gap-2">
        <DataTableViewOptions table={table} />
        {children}
      </div>
    </div>
  );
}
