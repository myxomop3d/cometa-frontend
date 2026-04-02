import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import type { DataGridCellProps } from "@/types/data-grid";
import type { ApiResponse } from "@/types/api";

// ── RelationSingleCell ──

export function RelationSingleCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  if (cellOpts?.variant !== "relation-single") return null;

  const {
    queryOptions: getQueryOptions,
    displayField,
    idField = "id",
  } = cellOpts;
  const value = cell.getValue() as Record<string, unknown> | null;
  const displayValue = value?.[displayField] as string | undefined;

  const [search, setSearch] = useState("");
  const debouncedSetSearch = useDebouncedCallback(setSearch, 300);

  const { data: response, isLoading } = useQuery({
    ...(getQueryOptions({ name: search, page: 1, pageSize: 10 }) as ReturnType<
      typeof queryOptions
    >),
    enabled: isEditing,
  });

  const items =
    (response as ApiResponse<Record<string, unknown>[]> | undefined)?.data ??
    [];

  const onSelect = useCallback(
    (item: Record<string, unknown>) => {
      tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: item });
      tableMeta?.onCellEditingStop?.();
    },
    [tableMeta, rowIndex, columnId],
  );

  const onClear = useCallback(() => {
    tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: null });
    tableMeta?.onCellEditingStop?.();
  }, [tableMeta, rowIndex, columnId]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
    >
      <Popover
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) tableMeta?.onCellEditingStop?.();
        }}
      >
        <PopoverAnchor className="size-full">
          <span className="truncate">
            {displayValue ?? (
              <span className="text-muted-foreground">---</span>
            )}
          </span>
        </PopoverAnchor>
        <PopoverContent
          data-grid-cell-editor
          className="w-70 p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              onValueChange={debouncedSetSearch}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading..." : "No results."}
              </CommandEmpty>
              <CommandGroup>
                {value && (
                  <CommandItem
                    onSelect={onClear}
                    className="text-muted-foreground"
                  >
                    Clear selection
                  </CommandItem>
                )}
                {items.map((item) => (
                  <CommandItem
                    key={String(item[idField])}
                    value={String(item[idField])}
                    onSelect={() => onSelect(item)}
                  >
                    {String(item[displayField])}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </DataGridCellWrapper>
  );
}

// ── RelationMultiCell ──

export function RelationMultiCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  if (cellOpts?.variant !== "relation-multi") return null;

  const {
    queryOptions: getQueryOptions,
    displayField,
    idField = "id",
  } = cellOpts;
  const rawValue = cell.getValue() as Record<string, unknown>[] | null;
  const initialValue = useMemo(
    () => rawValue ?? [],
    [rawValue],
  );
  const [selected, setSelected] =
    useState<Record<string, unknown>[]>(initialValue);
  const [search, setSearch] = useState("");
  const debouncedSetSearch = useDebouncedCallback(setSearch, 300);

  // Reset selected when initial value changes (e.g. after save)
  const prevRef = useRef(initialValue);
  if (initialValue !== prevRef.current) {
    prevRef.current = initialValue;
    setSelected(initialValue);
  }

  const { data: response, isLoading } = useQuery({
    ...(getQueryOptions({ name: search, page: 1, pageSize: 10 }) as ReturnType<
      typeof queryOptions
    >),
    enabled: isEditing,
  });

  const items =
    (response as ApiResponse<Record<string, unknown>[]> | undefined)?.data ??
    [];

  const isItemSelected = useCallback(
    (item: Record<string, unknown>) => {
      return selected.some((s) => s[idField] === item[idField]);
    },
    [selected, idField],
  );

  const onToggle = useCallback(
    (item: Record<string, unknown>) => {
      setSelected((prev) => {
        const exists = prev.some((s) => s[idField] === item[idField]);
        if (exists) {
          return prev.filter((s) => s[idField] !== item[idField]);
        }
        return [...prev, item];
      });
    },
    [idField],
  );

  const onApply = useCallback(() => {
    tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: selected });
    tableMeta?.onCellEditingStop?.();
  }, [selected, tableMeta, rowIndex, columnId]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
    >
      <Popover
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) onApply();
        }}
      >
        <PopoverAnchor className="size-full">
          <div className="flex items-center gap-1 overflow-hidden">
            {initialValue.length === 0 ? (
              <span className="text-muted-foreground">---</span>
            ) : (
              initialValue.map((item) => (
                <Badge
                  key={String(item[idField])}
                  variant="secondary"
                  className="text-xs"
                >
                  {String(item[displayField])}
                </Badge>
              ))
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          data-grid-cell-editor
          className="w-70 p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              onValueChange={debouncedSetSearch}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading..." : "No results."}
              </CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={String(item[idField])}
                    value={String(item[idField])}
                    onSelect={() => onToggle(item)}
                  >
                    <Checkbox
                      checked={isItemSelected(item)}
                      className="mr-2"
                    />
                    {String(item[displayField])}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t p-2">
            <Button size="sm" className="w-full" onClick={onApply}>
              Apply ({selected.length})
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </DataGridCellWrapper>
  );
}
