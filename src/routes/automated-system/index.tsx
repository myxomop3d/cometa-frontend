import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
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

export const Route = createFileRoute("/automated-system/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(automatedSystemsQueryOptions()),
  component: AutomatedSystemPage,
});

const columnHelper = createColumnHelper<AutomatedSystemDto>();

const columns = [
  columnHelper.accessor("name", { header: "Name" }),
  columnHelper.accessor("ci", { header: "CI" }),
  columnHelper.accessor("block", { header: "Block" }),
  columnHelper.accessor("tribe", { header: "Tribe" }),
  columnHelper.accessor("cluster", { header: "Cluster" }),
  columnHelper.accessor("status", { header: "Status" }),
  columnHelper.accessor("leader", { header: "Leader" }),
];

function AutomatedSystemPage() {
  const { data } = useSuspenseQuery(automatedSystemsQueryOptions());

  const table = useReactTable({
    data: data.data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <h1 className="text-3xl font-bold">Automated Systems</h1>
      <p className="mt-2 mb-4 text-muted-foreground">
        {data.count} systems
      </p>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
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
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
