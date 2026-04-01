import { useRef } from "react";
import { DataGridRow } from "@/components/data-grid/data-grid-row";
import {
  flexRender,
  getColumnBorderVisibility,
  getColumnPinningStyle,
} from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type { useServerDataGrid } from "@/hooks/useServerDataGrid";

interface DataGridProps<TData>
  extends Omit<
      ReturnType<typeof useServerDataGrid<TData>>,
      "onGridKeyDown" | "onGridBlur"
    >,
    Omit<React.ComponentProps<"div">, "children"> {
  onGridKeyDown: (event: React.KeyboardEvent) => void;
  onGridBlur: (event: React.FocusEvent) => void;
  height?: number;
}

export function DataGrid<TData>({
  dataGridRef,
  headerRef,
  table,
  tableMeta,
  virtualTotalSize,
  virtualItems,
  measureElement,
  columnSizeVars,
  columnVisibility,
  columnPinning,
  focusedCell,
  editingCell,
  onGridKeyDown,
  onGridBlur,
  height = 600,
  className,
  // Destructure non-DOM props to prevent them from spreading onto the div
  cellMapRef: _cellMapRef,
  columns: _columns,
  ...props
}: DataGridProps<TData>) {
  const rows = table.getRowModel().rows;
  const readOnly = tableMeta?.readOnly ?? false;
  const rowMapRef = useRef(new Map<number, HTMLDivElement>());

  const headerGroups = table.getHeaderGroups();

  return (
    <div
      role="grid"
      ref={dataGridRef}
      tabIndex={0}
      onKeyDown={onGridKeyDown}
      onBlur={onGridBlur}
      className={cn(
        "relative overflow-auto rounded-md border bg-background focus:outline-none",
        className,
      )}
      style={
        {
          height,
          ...columnSizeVars,
        } as React.CSSProperties
      }
      {...props}
    >
      {/* Header */}
      <div
        ref={headerRef}
        role="rowgroup"
        className="sticky top-0 z-10 bg-muted/50"
      >
        {headerGroups.map((headerGroup) => (
          <div key={headerGroup.id} role="row" className="flex">
            {headerGroup.headers.map((header, headerIndex) => {
              const { showEndBorder, showStartBorder } =
                getColumnBorderVisibility({
                  column: header.column,
                  nextColumn: headerGroup.headers[headerIndex + 1]?.column,
                  isLastColumn:
                    headerIndex === headerGroup.headers.length - 1,
                });

              return (
                <div
                  key={header.id}
                  role="columnheader"
                  className={cn(
                    "relative flex h-9 flex-none items-center border-b border-r px-2 text-xs font-medium text-muted-foreground",
                    !showEndBorder && "border-r-0",
                    showStartBorder && "border-l",
                  )}
                  style={{
                    ...getColumnPinningStyle({
                      column: header.column,
                      withBorder: true,
                    }),
                    width: `calc(var(--header-${header.id}-size) * 1px)`,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}

                  {/* Column resizer */}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={cn(
                      "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
                      header.column.getIsResizing() && "bg-primary",
                    )}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        role="rowgroup"
        className="relative"
        style={{ height: virtualTotalSize }}
      >
        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index];
          if (!row) return null;

          return (
            <DataGridRow
              key={row.id}
              row={row}
              tableMeta={tableMeta}
              virtualItem={virtualItem}
              measureElement={measureElement}
              rowMapRef={rowMapRef}
              columnVisibility={columnVisibility}
              columnPinning={columnPinning}
              focusedCell={focusedCell}
              editingCell={editingCell}
              readOnly={readOnly}
            />
          );
        })}
      </div>
    </div>
  );
}
