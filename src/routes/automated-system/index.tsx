import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
  type ColumnResizeMode,
  type VisibilityState,
} from "@tanstack/react-table";
import { automatedSystemsQueryOptions } from "@/api/queries/automated-system";
import type { AutomatedSystemDto } from "@/types/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/automated-system/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(automatedSystemsQueryOptions()),
  component: AutomatedSystemPage,
});

const columnHelper = createColumnHelper<AutomatedSystemDto>();

const columns = [
  columnHelper.accessor("name", { header: "Name", size: 200 }),
  columnHelper.accessor("ci", { header: "CI", size: 120 }),
  columnHelper.accessor("block", { header: "Block", size: 150 }),
  columnHelper.accessor("tribe", { header: "Tribe", size: 150 }),
  columnHelper.accessor("cluster", { header: "Cluster", size: 150 }),
  columnHelper.accessor("status", { header: "Status", size: 100 }),
  columnHelper.accessor("leader", { header: "Leader", size: 180 }),
];

const columnResizeMode: ColumnResizeMode = "onChange";

function AutomatedSystemPage() {
  const { data } = useSuspenseQuery(automatedSystemsQueryOptions());
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data: data.data,
    columns,
    columnResizeMode,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automated Systems</h1>
          <p className="mt-2 mb-4 text-muted-foreground">
            {data.count} systems
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Columns</Button>
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
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
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
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
