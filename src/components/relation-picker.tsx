import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/api";

export interface RelationPickerProps<TRelated> {
  multi: boolean;
  value: number | number[] | undefined;
  onChange: (value: number | number[] | undefined) => void;
  queryOptionsFn: (filters: Record<string, unknown>) => {
    queryKey: unknown[];
    queryFn: () => Promise<ApiResponse<TRelated[]>>;
  };
  columns: ColumnDef<TRelated, unknown>[];
  getLabel: (item: TRelated) => string;
  getId: (item: TRelated) => number;
  placeholder: string;
  className?: string;
  /** Render as inline button (for toolbar) vs form field style */
  variant?: "toolbar" | "field";
}

export function RelationPicker<TRelated>({
  multi,
  value,
  onChange,
  queryOptionsFn,
  columns,
  getLabel,
  getId,
  placeholder,
  className,
  variant = "toolbar",
}: RelationPickerProps<TRelated>) {
  const [open, setOpen] = React.useState(false);
  const [modalFilters, setModalFilters] = React.useState<
    Record<string, unknown>
  >({});
  const [modalSelection, setModalSelection] = React.useState<number[]>([]);

  // Fetch filtered data for modal (pageSize=10)
  const { data: filteredData, isFetching } = useQuery(
    queryOptionsFn({ ...modalFilters, pageSize: 10, page: 1 }) as Parameters<
      typeof useQuery
    >[0],
  );

  // Hydrate labels for selected IDs by fetching only those items via id filter
  const selectedIds = React.useMemo(() => {
    if (!value) return [];
    return multi ? (value as number[]) : [value as number];
  }, [value, multi]);

  const { data: labelData } = useQuery({
    ...(queryOptionsFn({ ids: selectedIds }) as Parameters<typeof useQuery>[0]),
    enabled: selectedIds.length > 0,
  });

  // Derive selected labels from the ID-filtered query
  const selectedLabels = React.useMemo(() => {
    if (selectedIds.length === 0) return [];
    const items = (labelData as ApiResponse<TRelated[]> | undefined)?.data;
    if (!items) {
      return selectedIds.map((id) => ({ id, label: `#${id}` }));
    }
    return selectedIds.map((id) => {
      const item = items.find((i: TRelated) => getId(i) === id);
      return { id, label: item ? getLabel(item) : `#${id}` };
    });
  }, [selectedIds, labelData, getLabel, getId]);

  // On modal open, initialize selection from current value
  React.useEffect(() => {
    if (open) {
      const ids = multi
        ? ((value as number[] | undefined) ?? [])
        : value !== undefined
          ? [value as number]
          : [];
      setModalSelection(ids);
      setModalFilters({});
    }
  }, [open, value, multi]);

  const handleRowClick = (item: TRelated) => {
    const id = getId(item);
    if (multi) {
      setModalSelection((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
      );
    } else {
      onChange(id);
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    if (multi) {
      onChange(modalSelection.length > 0 ? modalSelection : undefined);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  // Modal table
  const modalRows =
    (filteredData as ApiResponse<TRelated[]> | undefined)?.data ?? [];
  const modalTable = useReactTable({
    data: modalRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasValue = multi
    ? Array.isArray(value) && value.length > 0
    : value !== undefined;

  return (
    <>
      {variant === "toolbar" ? (
        <Button
          variant="outline"
          size="sm"
          className={cn("border-dashed font-normal", className)}
          onClick={() => setOpen(true)}
        >
          {hasValue ? (
            <div
              role="button"
              aria-label={`Clear ${placeholder} filter`}
              tabIndex={0}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
              onClick={handleClear}
            >
              <XCircle />
            </div>
          ) : (
            <PlusCircle />
          )}
          {placeholder}
          {hasValue && selectedLabels.length > 0 && (
            <div className="hidden items-center gap-1 lg:flex">
              {selectedLabels.length > 2 ? (
                <Badge
                  variant="secondary"
                  className="rounded-sm px-1 font-normal"
                >
                  {selectedLabels.length} selected
                </Badge>
              ) : (
                selectedLabels.map((s) => (
                  <Badge
                    key={s.id}
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {s.label}
                  </Badge>
                ))
              )}
            </div>
          )}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn("h-auto min-h-9 justify-start font-normal", className)}
          onClick={() => setOpen(true)}
        >
          {hasValue && selectedLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.map((s) => (
                <Badge
                  key={s.id}
                  variant="secondary"
                  className="rounded-sm px-1 font-normal"
                >
                  {s.label}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-min h-min max-w-5/6 max-h-5/6 sm:max-w-5/6 sm:max-h-5/6 flex flex-col">
          <DialogHeader>
            <DialogTitle>{placeholder}</DialogTitle>
          </DialogHeader>

          {/* Modal filters */}
          <div className="flex gap-2">
            <Input
              placeholder="Search..."
              value={(modalFilters.name as string) ?? ""}
              onChange={(e) =>
                setModalFilters((prev) => ({
                  ...prev,
                  name: e.target.value || undefined,
                }))
              }
              className="h-8"
            />
          </div>

          {/* Modal table */}
          <div className="max-h-[400px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                {modalTable.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {multi && <TableHead className="w-10" />}
                    {hg.headers.map((header) => (
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
                {isFetching ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (multi ? 1 : 0)}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : modalTable.getRowModel().rows.length > 0 ? (
                  modalTable.getRowModel().rows.map((row) => {
                    const id = getId(row.original);
                    const isSelected = modalSelection.includes(id);
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        data-state={isSelected ? "selected" : undefined}
                        onClick={() => handleRowClick(row.original)}
                      >
                        {multi && (
                          <TableCell className="w-10">
                            <Checkbox checked={isSelected} />
                          </TableCell>
                        )}
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (multi ? 1 : 0)}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {multi && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>
                Confirm ({modalSelection.length})
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
