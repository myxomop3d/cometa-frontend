import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import type { ApiResponse } from "@/types/api";
import type { FilterField } from "@/types/table";

interface RelationFilterProps<T> {
  mode: "dropdown" | "modal" | "both";
  multi: boolean;
  value: T | T[] | undefined;
  onChange: (value: T | T[] | undefined) => void;
  queryFn: () => Promise<ApiResponse<T[]>>;
  queryKey: string[];
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  placeholder?: string;
  className?: string;
  tableColumns?: ColumnDef<T, unknown>[];
  modalFilterFields?: FilterField[];
  modalQueryFn?: (filters: Record<string, unknown>) => Promise<ApiResponse<T[]>>;
}

export function RelationFilter<T>({
  mode,
  multi,
  value,
  onChange,
  queryFn,
  queryKey,
  getLabel,
  getId,
  placeholder = "Select...",
  className,
  tableColumns,
  modalFilterFields,
  modalQueryFn,
}: RelationFilterProps<T>) {
  const showDropdown = mode === "dropdown" || mode === "both";
  const showModal = mode === "modal" || mode === "both";

  const selectedItems: T[] = multi
    ? Array.isArray(value) ? value : []
    : value !== undefined ? [value as T] : [];

  const selectedIds = new Set(selectedItems.map(getId));

  const displayText = selectedItems.length === 0
    ? placeholder
    : multi
      ? `${selectedItems.length} selected`
      : getLabel(selectedItems[0]);

  return (
    <div className={`flex gap-1 min-w-0 ${className ?? ""}`}>
      {showDropdown && (
        <div className="flex-1 min-w-0">
        <DropdownPart
          queryFn={queryFn}
          queryKey={queryKey}
          getLabel={getLabel}
          getId={getId}
          multi={multi}
          selectedIds={selectedIds}
          selectedItems={selectedItems}
          onChange={onChange}
          displayText={displayText}
          hasSelection={selectedItems.length > 0}
        />
        </div>
      )}
      {showModal && (
        <ModalPart
          mode={mode as "modal" | "both"}
          multi={multi}
          queryFn={queryFn}
          queryKey={queryKey}
          getLabel={getLabel}
          getId={getId}
          selectedIds={selectedIds}
          selectedItems={selectedItems}
          onChange={onChange}
          displayText={showDropdown ? undefined : displayText}
          hasSelection={selectedItems.length > 0}
          tableColumns={tableColumns}
          modalFilterFields={modalFilterFields}
          modalQueryFn={modalQueryFn}
        />
      )}
    </div>
  );
}

// ── Dropdown Part ──────────────────────────────────────────

interface DropdownPartProps<T> {
  queryFn: () => Promise<ApiResponse<T[]>>;
  queryKey: string[];
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  multi: boolean;
  selectedIds: Set<number>;
  selectedItems: T[];
  onChange: (value: T | T[] | undefined) => void;
  displayText: string;
  hasSelection: boolean;
}

function DropdownPart<T>({
  queryFn,
  queryKey,
  getLabel,
  getId,
  multi,
  selectedIds,
  selectedItems,
  onChange,
  displayText,
  hasSelection,
}: DropdownPartProps<T>) {
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey,
    queryFn: () => queryFn(),
  });

  const filtered = useMemo(() => {
    const items = data?.data ?? [];
    if (!search) return items;
    const lower = search.toLowerCase();
    return items.filter((item) => getLabel(item).toLowerCase().includes(lower));
  }, [data, search, getLabel]);

  const toggleItem = (item: T) => {
    const id = getId(item);
    if (multi) {
      if (selectedIds.has(id)) {
        const next = selectedItems.filter((s) => getId(s) !== id);
        onChange(next.length > 0 ? next : undefined);
      } else {
        onChange([...selectedItems, item]);
      }
    } else {
      if (selectedIds.has(id)) {
        onChange(undefined);
      } else {
        onChange(item);
      }
    }
  };

  return (
    <ButtonGroup className="w-full">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className="flex-1 justify-start text-left font-normal min-w-0"
            />
          }
        >
          {displayText}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 p-0 h-8 focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map((item) => {
              const id = getId(item);
              const isSelected = selectedIds.has(id);
              return (
                <div
                  key={id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent ${
                    isSelected ? "bg-accent/50" : ""
                  }`}
                  onClick={() => toggleItem(item)}
                >
                  {multi && <Checkbox checked={isSelected} />}
                  <span className="text-sm">{getLabel(item)}</span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No results
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {hasSelection && (
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Clear selection"
          onClick={(e) => {
            e.stopPropagation();
            onChange(undefined);
          }}
        >
          <X />
        </Button>
      )}
    </ButtonGroup>
  );
}

// ── Modal Part ──────────────────────────────────────────────

interface ModalPartProps<T> {
  mode: "modal" | "both";
  multi: boolean;
  queryFn: () => Promise<ApiResponse<T[]>>;
  queryKey: string[];
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  selectedIds: Set<number>;
  selectedItems: T[];
  onChange: (value: T | T[] | undefined) => void;
  displayText: string | undefined;
  hasSelection: boolean;
  tableColumns?: ColumnDef<T, unknown>[];
  modalFilterFields?: FilterField[];
  modalQueryFn?: (filters: Record<string, unknown>) => Promise<ApiResponse<T[]>>;
}

function ModalPart<T>({
  mode,
  multi,
  queryFn,
  queryKey,
  getLabel,
  getId,
  selectedItems,
  onChange,
  displayText,
  hasSelection,
  tableColumns,
  modalFilterFields,
  modalQueryFn,
}: ModalPartProps<T>) {
  const [open, setOpen] = useState(false);
  const [modalSelection, setModalSelection] = useState<T[]>([]);
  const [modalFilters, setModalFilters] = useState<Record<string, unknown>>({});
  const useServerFiltering = mode === "modal" && !!modalQueryFn;

  const serverQuery = useQuery({
    queryKey: [...queryKey, "modal", modalFilters],
    queryFn: async () => {
      if (!modalQueryFn) throw new Error("modalQueryFn required");
      return await modalQueryFn(modalFilters);
    },
    enabled: open && useServerFiltering,
  });

  const clientQuery = useQuery({
    queryKey,
    queryFn: () => queryFn(),
    enabled: open && !useServerFiltering,
  });

  const modalData = useServerFiltering
    ? (serverQuery.data?.data ?? [])
    : (clientQuery.data?.data ?? []);

  const defaultColumns: ColumnDef<T, unknown>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row: T) => getLabel(row),
      },
    ],
    [getLabel],
  );

  const columns = tableColumns ?? defaultColumns;

  const table = useReactTable({
    data: modalData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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

  return (
    <>
      {displayText !== undefined ? (
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
              size="icon-sm"
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
            >
              <X />
            </Button>
          )}
        </ButtonGroup>
      ) : (
        <Button variant="outline" size="icon" onClick={handleOpen} title="Browse...">
          <Search className="h-4 w-4" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select {multi ? "items" : "item"}</DialogTitle>
          </DialogHeader>

          {useServerFiltering && modalFilterFields && (
            <div className="grid grid-cols-3 gap-2">
              {modalFilterFields.map(({ key, label }) => (
                <DebouncedInput
                  key={key}
                  placeholder={label}
                  value={(modalFilters[key] as string) ?? ""}
                  onChange={(v) =>
                    setModalFilters((prev) => ({ ...prev, [key]: v || undefined }))
                  }
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
