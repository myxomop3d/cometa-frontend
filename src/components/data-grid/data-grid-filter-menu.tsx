import { useCallback, useId, useMemo, useState } from "react";
import {
  CalendarIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  ListFilterIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
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
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  getDefaultOperator,
  getOperatorsForVariant,
} from "@/lib/data-grid-filters";
import { cn } from "@/lib/utils";
import type {
  CellSelectOption,
  FilterColumnDef,
  FilterEntry,
  FilterOperator,
} from "@/types/data-grid";

const FILTER_DEBOUNCE_MS = 300;
const OPERATORS_WITHOUT_VALUE = new Set([
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
]);

interface DataGridFilterMenuProps {
  columns: FilterColumnDef[];
  filters: FilterEntry[];
  onFiltersChange: (filters: FilterEntry[]) => void;
  disabled?: boolean;
}

export function DataGridFilterMenu({
  columns,
  filters,
  onFiltersChange,
  disabled,
}: DataGridFilterMenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  const { columnLabels, columnVariants, columnOptions, availableColumns } =
    useMemo(() => {
      const labels = new Map<string, string>();
      const variants = new Map<string, string>();
      const options = new Map<string, CellSelectOption[]>();
      const filterIds = new Set(filters.map((f) => f.id));
      const available: { id: string; label: string }[] = [];

      for (const col of columns) {
        labels.set(col.id, col.label);
        variants.set(col.id, col.variant);
        if (col.options) options.set(col.id, col.options);
        if (!filterIds.has(col.id)) {
          available.push({ id: col.id, label: col.label });
        }
      }

      return {
        columnLabels: labels,
        columnVariants: variants,
        columnOptions: options,
        availableColumns: available,
      };
    }, [columns, filters]);

  const onFilterAdd = useCallback(() => {
    const first = availableColumns[0];
    if (!first) return;
    const variant = columnVariants.get(first.id) ?? "short-text";
    onFiltersChange([
      ...filters,
      { id: first.id, operator: getDefaultOperator(variant) },
    ]);
  }, [availableColumns, columnVariants, filters, onFiltersChange]);

  const onFilterUpdate = useCallback(
    (filterId: string, updates: Partial<FilterEntry>) => {
      onFiltersChange(
        filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
      );
    },
    [filters, onFiltersChange],
  );

  const onFilterRemove = useCallback(
    (filterId: string) => {
      onFiltersChange(filters.filter((f) => f.id !== filterId));
    },
    [filters, onFiltersChange],
  );

  const onFiltersReset = useCallback(() => {
    onFiltersChange([]);
  }, [onFiltersChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-normal"
          disabled={disabled}
        >
          <ListFilterIcon className="text-muted-foreground" />
          Filter
          {filters.length > 0 && (
            <Badge
              variant="secondary"
              className="h-[18px] rounded px-1.5 font-mono text-[10px] font-normal"
            >
              {filters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-full min-w-[480px] max-w-[calc(var(--radix-popover-content-available-width))] flex-col gap-3.5 p-4">
        <div className="flex flex-col gap-1">
          <h4 className="font-medium leading-none">
            {filters.length > 0 ? "Filter by" : "No filters applied"}
          </h4>
          <p className="text-sm text-muted-foreground">
            {filters.length > 0
              ? "Modify filters to narrow down your data."
              : "Add filters to narrow down your data."}
          </p>
        </div>
        {filters.length > 0 && (
          <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
            {filters.map((filter, index) => (
              <FilterItem
                key={filter.id}
                filter={filter}
                index={index}
                itemId={`${id}-filter-${filter.id}`}
                availableColumns={availableColumns}
                columnLabels={columnLabels}
                columnVariants={columnVariants}
                columnOptions={columnOptions}
                onFilterUpdate={onFilterUpdate}
                onFilterRemove={onFilterRemove}
                onFiltersChange={onFiltersChange}
                filters={filters}
              />
            ))}
          </div>
        )}
        <div className="flex w-full items-center gap-2">
          <Button
            size="sm"
            className="rounded"
            onClick={onFilterAdd}
            disabled={availableColumns.length === 0}
          >
            Add filter
          </Button>
          {filters.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded"
              onClick={onFiltersReset}
            >
              Reset filters
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FilterItemProps {
  filter: FilterEntry;
  index: number;
  itemId: string;
  availableColumns: { id: string; label: string }[];
  columnLabels: Map<string, string>;
  columnVariants: Map<string, string>;
  columnOptions: Map<string, CellSelectOption[]>;
  onFilterUpdate: (filterId: string, updates: Partial<FilterEntry>) => void;
  onFilterRemove: (filterId: string) => void;
  onFiltersChange: (filters: FilterEntry[]) => void;
  filters: FilterEntry[];
}

function FilterItem({
  filter,
  index,
  itemId,
  availableColumns,
  columnLabels,
  columnVariants,
  columnOptions,
  onFilterUpdate,
  onFilterRemove,
  onFiltersChange,
  filters,
}: FilterItemProps) {
  const [showFieldSelector, setShowFieldSelector] = useState(false);

  const variant = columnVariants.get(filter.id) ?? "short-text";
  const operator = filter.operator;
  const operators = getOperatorsForVariant(variant);
  const needsValue = !OPERATORS_WITHOUT_VALUE.has(operator);
  const options = columnOptions.get(filter.id);

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-[72px] text-center">
        <span className="text-sm text-muted-foreground">
          {index === 0 ? "Where" : "And"}
        </span>
      </div>
      <Popover open={showFieldSelector} onOpenChange={setShowFieldSelector}>
        <PopoverTrigger asChild>
          <Button
            id={`${itemId}-field`}
            variant="outline"
            size="sm"
            className="w-32 justify-between rounded font-normal"
          >
            <span className="truncate">{columnLabels.get(filter.id)}</span>
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-40 p-0">
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
                      const newVariant =
                        columnVariants.get(value) ?? "short-text";
                      const newOperator = getDefaultOperator(newVariant);
                      onFiltersChange(
                        filters.map((f) =>
                          f.id === filter.id
                            ? { id: value, operator: newOperator }
                            : f,
                        ),
                      );
                      setShowFieldSelector(false);
                    }}
                  >
                    <span className="truncate">{col.label}</span>
                    <CheckIcon
                      className={cn(
                        "ms-auto",
                        col.id === filter.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Select
        value={operator}
        onValueChange={(value) =>
          onFilterUpdate(filter.id, { operator: value as FilterOperator })
        }
      >
        <SelectTrigger size="sm" className="w-32 rounded lowercase">
          <div className="truncate">
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem
              key={op.value}
              value={op.value}
              className="lowercase"
            >
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="min-w-36 max-w-60 flex-1">
        {needsValue ? (
          <FilterInput
            variant={variant}
            operator={operator}
            inputId={`${itemId}-input`}
            value={filter.value}
            endValue={filter.endValue}
            options={options}
            onValueChange={(value) => onFilterUpdate(filter.id, { value })}
            onEndValueChange={(endValue) =>
              onFilterUpdate(filter.id, {
                endValue: endValue as string | number | undefined,
              })
            }
          />
        ) : (
          <div className="h-8 w-full rounded border bg-transparent" />
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-8 rounded"
        onClick={() => onFilterRemove(filter.id)}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}

interface FilterInputProps {
  variant: string;
  operator: string;
  inputId: string;
  value: string | number | string[] | undefined;
  endValue?: string | number;
  options?: CellSelectOption[];
  onValueChange: (value: string | number | string[] | undefined) => void;
  onEndValueChange?: (value: string | number | string[] | undefined) => void;
}

function FilterInput({
  variant,
  operator,
  inputId,
  value,
  endValue,
  options,
  onValueChange,
  onEndValueChange,
}: FilterInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [localEndValue, setLocalEndValue] = useState(endValue);
  const [showValueSelector, setShowValueSelector] = useState(false);

  const debouncedOnChange = useDebouncedCallback(
    (v: string | number | string[] | undefined) => onValueChange(v),
    FILTER_DEBOUNCE_MS,
  );

  const debouncedOnEndChange = useDebouncedCallback(
    (v: string | number | string[] | undefined) => onEndValueChange?.(v),
    FILTER_DEBOUNCE_MS,
  );

  const isBetween = operator === "isBetween";

  // Number input
  if (variant === "number") {
    if (isBetween) {
      return (
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="number"
            inputMode="numeric"
            placeholder="Start"
            value={(localValue as number | undefined) ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? undefined : Number(e.target.value);
              setLocalValue(v);
              debouncedOnChange(v);
            }}
            className="h-8 w-full flex-1 rounded"
          />
          <Input
            id={`${inputId}-end`}
            type="number"
            inputMode="numeric"
            placeholder="End"
            value={(localEndValue as number | undefined) ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? undefined : Number(e.target.value);
              setLocalEndValue(v);
              debouncedOnEndChange(v);
            }}
            className="h-8 w-full flex-1 rounded"
          />
        </div>
      );
    }

    return (
      <Input
        id={inputId}
        type="number"
        inputMode="numeric"
        placeholder="Value"
        value={(localValue as number | undefined) ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? undefined : Number(e.target.value);
          setLocalValue(v);
          debouncedOnChange(v);
        }}
        className="h-8 w-full rounded"
      />
    );
  }

  // Date input
  if (variant === "date") {
    if (isBetween) {
      const startDate =
        localValue && typeof localValue === "string"
          ? new Date(localValue)
          : undefined;
      const endDate =
        localEndValue && typeof localEndValue === "string"
          ? new Date(localEndValue as string)
          : undefined;

      return (
        <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
          <PopoverTrigger asChild>
            <Button
              id={inputId}
              variant="outline"
              size="sm"
              className={cn(
                "h-8 w-full justify-start rounded font-normal",
                !startDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon />
              <span className="truncate">
                {startDate && endDate
                  ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
                  : startDate
                    ? startDate.toLocaleDateString()
                    : "Pick a range"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              autoFocus
              mode="range"
              selected={
                startDate && endDate
                  ? { from: startDate, to: endDate }
                  : startDate
                    ? { from: startDate, to: startDate }
                    : undefined
              }
              onSelect={(range) => {
                const from = range?.from?.toISOString();
                const to = range?.to?.toISOString();
                setLocalValue(from);
                setLocalEndValue(to);
                onValueChange(from);
                onEndValueChange?.(to);
              }}
            />
          </PopoverContent>
        </Popover>
      );
    }

    const dateValue =
      localValue && typeof localValue === "string"
        ? new Date(localValue)
        : undefined;

    return (
      <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            variant="outline"
            size="sm"
            className={cn(
              "h-8 w-full justify-start rounded font-normal",
              !dateValue && "text-muted-foreground",
            )}
          >
            <CalendarIcon />
            <span className="truncate">
              {dateValue ? dateValue.toLocaleDateString() : "Pick a date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            autoFocus
            mode="single"
            selected={dateValue}
            onSelect={(date) => {
              const v = date?.toISOString();
              setLocalValue(v);
              onValueChange(v);
              setShowValueSelector(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Select / Multi-select input
  const isSelectVariant = variant === "select" || variant === "multi-select";
  const isMultiOperator = operator === "isAnyOf" || operator === "isNoneOf";

  if (isSelectVariant && options && options.length > 0) {
    if (isMultiOperator) {
      const selected = Array.isArray(value) ? value : [];

      return (
        <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
          <PopoverTrigger asChild>
            <Button
              id={inputId}
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start rounded font-normal"
            >
              {selected.length === 0 ? (
                <span className="text-muted-foreground">Value</span>
              ) : (
                <span className="truncate">
                  {selected.length > 1
                    ? `${selected.length} selected`
                    : options.find((o) => o.value === selected[0])?.label ??
                      selected[0]}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-0">
            <Command>
              <CommandInput placeholder="Search options..." />
              <CommandList>
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => {
                    const isSelected = selected.includes(opt.value);
                    return (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={() => {
                          const next = isSelected
                            ? selected.filter((v) => v !== opt.value)
                            : [...selected, opt.value];
                          onValueChange(next.length > 0 ? next : undefined);
                        }}
                      >
                        <span className="truncate">{opt.label}</span>
                        <CheckIcon
                          className={cn(
                            "ms-auto",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    }

    const selectedOpt = options.find((o) => o.value === (value as string));

    return (
      <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            variant="outline"
            size="sm"
            className="h-8 w-full justify-start rounded font-normal"
          >
            {selectedOpt ? (
              <span className="truncate">{selectedOpt.label}</span>
            ) : (
              <span className="text-muted-foreground">Value</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search options..." />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setShowValueSelector(false);
                    }}
                  >
                    <span className="truncate">{opt.label}</span>
                    <CheckIcon
                      className={cn(
                        "ms-auto",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  // Between text
  if (isBetween) {
    return (
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="text"
          placeholder="Start"
          className="h-8 w-full flex-1 rounded"
          value={(localValue as string | undefined) ?? ""}
          onChange={(e) => {
            const v = e.target.value || undefined;
            setLocalValue(v);
            debouncedOnChange(v);
          }}
        />
        <Input
          id={`${inputId}-end`}
          type="text"
          placeholder="End"
          className="h-8 w-full flex-1 rounded"
          value={(localEndValue as string | undefined) ?? ""}
          onChange={(e) => {
            const v = e.target.value || undefined;
            setLocalEndValue(v);
            debouncedOnEndChange(v);
          }}
        />
      </div>
    );
  }

  // Default text input
  return (
    <Input
      id={inputId}
      type="text"
      placeholder="Value"
      className="h-8 w-full rounded"
      value={(localValue as string | undefined) ?? ""}
      onChange={(e) => {
        const v = e.target.value || undefined;
        setLocalValue(v);
        debouncedOnChange(v);
      }}
    />
  );
}
