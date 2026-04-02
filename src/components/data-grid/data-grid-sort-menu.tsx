import { useCallback, useId, useMemo, useState } from "react";
import {
  ArrowDownUpIcon,
  ChevronsUpDownIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortEntry } from "@/types/data-grid";

const SORT_ORDERS = [
  { label: "Asc", value: "asc" },
  { label: "Desc", value: "desc" },
] as const;

interface DataGridSortMenuProps {
  columns: { id: string; label: string }[];
  sorting: SortEntry[];
  onSortingChange: (sorting: SortEntry[]) => void;
  disabled?: boolean;
}

export function DataGridSortMenu({
  columns: allColumns,
  sorting,
  onSortingChange,
  disabled,
}: DataGridSortMenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  const { columnLabels, availableColumns } = useMemo(() => {
    const labels = new Map<string, string>();
    const sortingIds = new Set(sorting.map((s) => s.id));
    const available: { id: string; label: string }[] = [];

    for (const col of allColumns) {
      labels.set(col.id, col.label);
      if (!sortingIds.has(col.id)) {
        available.push(col);
      }
    }

    return { columnLabels: labels, availableColumns: available };
  }, [allColumns, sorting]);

  const onSortAdd = useCallback(() => {
    const first = availableColumns[0];
    if (!first) return;
    onSortingChange([...sorting, { id: first.id, desc: false }]);
  }, [availableColumns, sorting, onSortingChange]);

  const onSortUpdate = useCallback(
    (sortId: string, updates: Partial<SortEntry>) => {
      onSortingChange(
        sorting.map((s) => (s.id === sortId ? { ...s, ...updates } : s)),
      );
    },
    [sorting, onSortingChange],
  );

  const onSortRemove = useCallback(
    (sortId: string) => {
      onSortingChange(sorting.filter((s) => s.id !== sortId));
    },
    [sorting, onSortingChange],
  );

  const onSortingReset = useCallback(() => {
    onSortingChange([]);
  }, [onSortingChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-normal"
          disabled={disabled}
        >
          <ArrowDownUpIcon className="text-muted-foreground" />
          Sort
          {sorting.length > 0 && (
            <Badge
              variant="secondary"
              className="h-[18px] rounded px-1.5 font-mono text-[10px] font-normal"
            >
              {sorting.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-full min-w-[380px] max-w-[calc(var(--radix-popover-content-available-width))] flex-col gap-3.5 p-4">
        <div className="flex flex-col gap-1">
          <h4 className="font-medium leading-none">
            {sorting.length > 0 ? "Sort by" : "No sorting applied"}
          </h4>
          <p className="text-sm text-muted-foreground">
            {sorting.length > 0
              ? "Modify sorting to organize your rows."
              : "Add sorting to organize your rows."}
          </p>
        </div>
        {sorting.length > 0 && (
          <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
            {sorting.map((sort) => (
              <SortItem
                key={sort.id}
                sort={sort}
                itemId={`${id}-sort-${sort.id}`}
                availableColumns={availableColumns}
                columnLabels={columnLabels}
                onSortUpdate={onSortUpdate}
                onSortRemove={onSortRemove}
              />
            ))}
          </div>
        )}
        <div className="flex w-full items-center gap-2">
          <Button
            size="sm"
            className="rounded"
            onClick={onSortAdd}
            disabled={availableColumns.length === 0}
          >
            Add sort
          </Button>
          {sorting.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded"
              onClick={onSortingReset}
            >
              Reset sorting
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SortItemProps {
  sort: SortEntry;
  itemId: string;
  availableColumns: { id: string; label: string }[];
  columnLabels: Map<string, string>;
  onSortUpdate: (sortId: string, updates: Partial<SortEntry>) => void;
  onSortRemove: (sortId: string) => void;
}

function SortItem({
  sort,
  itemId,
  availableColumns,
  columnLabels,
  onSortUpdate,
  onSortRemove,
}: SortItemProps) {
  const [showFieldSelector, setShowFieldSelector] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Popover open={showFieldSelector} onOpenChange={setShowFieldSelector}>
        <PopoverTrigger asChild>
          <Button
            id={`${itemId}-field`}
            variant="outline"
            size="sm"
            className="w-44 justify-between rounded font-normal"
          >
            <span className="truncate">{columnLabels.get(sort.id)}</span>
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Search fields..." />
            <CommandList>
              <CommandEmpty>No fields found.</CommandEmpty>
              <CommandGroup>
                {availableColumns.map((col) => (
                  <CommandItem
                    key={col.id}
                    value={col.id}
                    onSelect={(value) => {
                      onSortUpdate(sort.id, { id: value });
                      setShowFieldSelector(false);
                    }}
                  >
                    <span className="truncate">{col.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Select
        value={sort.desc ? "desc" : "asc"}
        onValueChange={(value) =>
          onSortUpdate(sort.id, { desc: value === "desc" })
        }
      >
        <SelectTrigger size="sm" className="w-24 rounded">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_ORDERS.map((order) => (
            <SelectItem key={order.value} value={order.value}>
              {order.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0 rounded"
        onClick={() => onSortRemove(sort.id)}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
