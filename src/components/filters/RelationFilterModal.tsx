import { useState, useMemo, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Search, Delete, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ButtonGroup } from "@/components/ui/button-group";
import { DebouncedInput } from "@/components/DebouncedInput";
import type { FilterField } from "@/types/table";

interface RelationFilterModalProps<T> {
  multi: boolean;
  value: T | T[] | undefined;
  onChange: (value: T | T[] | undefined) => void;
  data: T[];
  isLoading?: boolean;
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  placeholder?: string;
  className?: string;
  tableColumns?: ColumnDef<T, unknown>[];
  filterFields?: FilterField[];
  onFiltersChange?: (filters: Record<string, unknown>) => void;
}

export function RelationFilterModal<T>({
  multi,
  value,
  onChange,
  data,
  isLoading,
  getLabel,
  getId,
  placeholder = "Select...",
  className,
  tableColumns,
  filterFields,
  onFiltersChange,
}: RelationFilterModalProps<T>) {
  const [open, setOpen] = useState(false);
  const [modalSelection, setModalSelection] = useState<T[]>([]);
  const [modalFilters, setModalFilters] = useState<Record<string, unknown>>({});

  // Stabilize getLabel via ref to prevent useReactTable infinite render loop.
  const getLabelRef = useRef(getLabel);
  getLabelRef.current = getLabel;

  const selectedItems: T[] = multi
    ? Array.isArray(value) ? value : []
    : value !== undefined ? [value as T] : [];

  const selectedIds = new Set(selectedItems.map(getId));

  const displayText = selectedItems.length === 0
    ? placeholder
    : multi
      ? `${selectedItems.length} selected`
      : getLabel(selectedItems[0]);

  const hasSelection = selectedItems.length > 0;

  const defaultColumns: ColumnDef<T, unknown>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row: T) => getLabelRef.current(row),
      },
    ],
    [],
  );

  const columns = tableColumns ?? defaultColumns;

  const coreRowModel = useMemo(() => getCoreRowModel<T>(), []);
  const filteredRowModel = useMemo(() => getFilteredRowModel<T>(), []);
  const paginationRowModel = useMemo(() => getPaginationRowModel<T>(), []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getPaginationRowModel: paginationRowModel,
  });

  const handleOpen = () => {
    setModalSelection([...selectedItems]);
    setOpen(true);
  };

  const handleConfirm = () => {
    if (multi) {
      onChange(modalSelection.length > 0 ? modalSelection : undefined);
    } else {
      onChange(modalSelection.length > 0 ? modalSelection[0] : undefined);
    }
    setOpen(false);
  };

  const toggleModalItem = (item: T) => {
    const id = getId(item);
    if (multi) {
      const exists = modalSelection.some((s) => getId(s) === id);
      if (exists) {
        setModalSelection(modalSelection.filter((s) => getId(s) !== id));
      } else {
        setModalSelection([...modalSelection, item]);
      }
    } else {
      onChange(item);
      setOpen(false);
    }
  };

  const modalSelectionIds = new Set(modalSelection.map(getId));

  const handleFilterChange = (key: string, val: string) => {
    const next = { ...modalFilters, [key]: val || undefined };
    setModalFilters(next);
    onFiltersChange?.(next);
  };

  return (
    <div className={className}>
      <ButtonGroup className="w-full">
        <Button
          variant="outline"
          className="flex-1 justify-start text-left font-normal min-w-0"
          onClick={handleOpen}
        >
          {displayText}
        </Button>
        {hasSelection && (
          <Button
            variant="outline"
            aria-label="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
          >
            <Delete />
          </Button>
        )}
      </ButtonGroup>

      <Dialog open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select {multi ? "items" : "item"}</DialogTitle>
          </DialogHeader>

          {filterFields && filterFields.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {filterFields.map(({ key, label }) => (
                <DebouncedInput
                  key={key}
                  placeholder={label}
                  value={(modalFilters[key] as string) ?? ""}
                  onChange={(v) => handleFilterChange(key, v)}
                />
              ))}
            </div>
          )}

          {multi && modalSelection.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {modalSelection.map((item) => (
                <Badge
                  key={getId(item)}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => toggleModalItem(item)}
                >
                  {getLabel(item)} ×
                </Badge>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {multi && <TableHead className="w-10" />}
                      {hg.headers.map((header) => (
                        <TableHead key={header.id}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => {
                    const isSelected = modalSelectionIds.has(getId(row.original));
                    return (
                      <TableRow
                        key={row.id}
                        className={`cursor-pointer ${isSelected ? "bg-accent/50" : ""}`}
                        onClick={() => toggleModalItem(row.original)}
                      >
                        {multi && (
                          <TableCell>
                            <Checkbox checked={isSelected} />
                          </TableCell>
                        )}
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  {table.getRowModel().rows.length === 0 && (
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
            )}
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
    </div>
  );
}
