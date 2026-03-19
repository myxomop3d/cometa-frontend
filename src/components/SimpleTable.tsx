import {
  flexRender,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DebouncedInput } from "@/components/DebouncedInput";

interface FilterField {
  key: string;
  label: string;
}

interface SimpleTableProps<TData> {
  table: TanStackTable<TData>;

  // Pagination (optional)
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;

  // Filters (optional)
  filterFields?: FilterField[];
  filters?: Record<string, unknown>;
  onFilterChange?: (partial: Record<string, unknown>) => void;
}

export function SimpleTable<TData>({
  table,
  page,
  pageCount,
  onPageChange,
  filterFields,
  filters,
  onFilterChange,
}: SimpleTableProps<TData>) {
  const hasPagination =
    page !== undefined && pageCount !== undefined && onPageChange !== undefined;
  const hasFilters =
    filterFields !== undefined &&
    filters !== undefined &&
    onFilterChange !== undefined;

  return (
    <>
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "outline" })}>
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table.getAllColumns().map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {typeof column.columnDef.header === "string"
                  ? column.columnDef.header
                  : column.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasFilters && (
        <div className="grid grid-cols-4 gap-2 my-4">
          {filterFields.map(({ key, label }) => (
            <DebouncedInput
              key={key}
              placeholder={label}
              value={(filters[key] as string) ?? ""}
              onChange={(value) =>
                onFilterChange({ [key]: value || undefined })
              }
            />
          ))}
        </div>
      )}

      <Table style={{ width: table.getCenterTotalSize() }}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="relative"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    onDoubleClick={() => header.column.resetSize()}
                    className={`absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none ${
                      header.column.getIsResizing()
                        ? "bg-primary"
                        : "bg-transparent hover:bg-border"
                    }`}
                  />
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getAllColumns().length}
                className="h-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {hasPagination && (
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
