import * as React from "react";
import type { Column, Table } from "@tanstack/react-table";
import { Filter, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { RelationPicker } from "@/components/relation-picker";
import { operatorsByVariant, operatorLabels } from "@/config/data-table";
import type {
  ExtendedColumnFilter,
  FilterOperator,
  FilterVariant,
} from "@/types/data-table";

export interface DataTableFilterListProps<TData> {
  table: Table<TData>;
  filters: ExtendedColumnFilter[];
  joinOperator: "and" | "or";
  onChange: (next: {
    filters: ExtendedColumnFilter[];
    joinOperator: "and" | "or";
  }) => void;
}

function areFiltersEqual(
  a: ExtendedColumnFilter[],
  b: ExtendedColumnFilter[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function DataTableFilterList<TData>({
  table,
  filters,
  joinOperator,
  onChange,
}: DataTableFilterListProps<TData>) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<ExtendedColumnFilter[]>(filters);
  const [draftJoin, setDraftJoin] = React.useState<"and" | "or">(joinOperator);

  // Re-sync from props when they change externally.
  const propsRef = React.useRef({ filters, joinOperator });
  React.useEffect(() => {
    const prev = propsRef.current;
    if (
      !areFiltersEqual(prev.filters, filters) ||
      prev.joinOperator !== joinOperator
    ) {
      propsRef.current = { filters, joinOperator };
      setDraft(filters);
      setDraftJoin(joinOperator);
    }
  }, [filters, joinOperator]);

  // Debounced commit of draft → onChange.
  React.useEffect(() => {
    if (
      areFiltersEqual(draft, propsRef.current.filters) &&
      draftJoin === propsRef.current.joinOperator
    ) {
      return;
    }
    const t = setTimeout(() => {
      propsRef.current = { filters: draft, joinOperator: draftJoin };
      onChange({ filters: draft, joinOperator: draftJoin });
    }, 300);
    return () => clearTimeout(t);
  }, [draft, draftJoin, onChange]);

  const filterableColumns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter((c) => c.columnDef.meta?.variant !== undefined),
    [table],
  );

  const columnById = React.useMemo(() => {
    const map = new Map<string, Column<TData, unknown>>();
    for (const c of filterableColumns) map.set(c.id, c);
    return map;
  }, [filterableColumns]);

  const updateRow = (
    index: number,
    patch: Partial<ExtendedColumnFilter>,
  ) => {
    setDraft((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = (columnId: string) => {
    const col = columnById.get(columnId);
    if (!col) return;
    const variant = col.columnDef.meta?.variant as FilterVariant | undefined;
    if (!variant) return;
    const op = operatorsByVariant[variant][0];
    setDraft((prev) => [...prev, { id: columnId, operator: op, value: undefined }]);
  };

  const resetAll = () => {
    setDraft([]);
    setDraftJoin("and");
  };

  const count = filters.length;
  const hasAnything = draft.length > 0 || draftJoin !== "and";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <Filter />
          Filter
          {count > 0 && (
            <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[680px] p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {draft.length === 0 ? (
          <div className="px-1 py-2 text-sm text-muted-foreground">
            No filters applied. Add one below.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {draft.map((row, index) => {
              const col = columnById.get(row.id);
              const variant = col?.columnDef.meta?.variant as
                | FilterVariant
                | undefined;
              const operators = variant ? operatorsByVariant[variant] : [];

              return (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-[72px] shrink-0 text-xs text-muted-foreground">
                    {index === 0 ? (
                      "Where"
                    ) : index === 1 ? (
                      <Select
                        value={draftJoin}
                        onValueChange={(v) => setDraftJoin(v as "and" | "or")}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="and">and</SelectItem>
                          <SelectItem value="or">or</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="pl-2">{draftJoin}</span>
                    )}
                  </div>

                  <FieldPicker
                    columns={filterableColumns}
                    value={row.id}
                    onChange={(newId) => {
                      const newCol = columnById.get(newId);
                      const newVariant = newCol?.columnDef.meta?.variant as
                        | FilterVariant
                        | undefined;
                      if (!newVariant) return;
                      updateRow(index, {
                        id: newId,
                        operator: operatorsByVariant[newVariant][0],
                        value: undefined,
                      });
                    }}
                  />

                  <Select
                    value={row.operator}
                    onValueChange={(v) =>
                      updateRow(index, {
                        operator: v as FilterOperator,
                        value: undefined,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-[150px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op} value={op}>
                          {operatorLabels[op]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex-1 min-w-0">
                    {col && variant ? (
                      <ValueInput
                        column={col}
                        variant={variant}
                        operator={row.operator}
                        value={row.value}
                        onChange={(value) => updateRow(index, { value })}
                      />
                    ) : null}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeRow(index)}
                    aria-label="Remove filter"
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <AddFilterButton columns={filterableColumns} onPick={addRow} />
          {hasAnything && (
            <Button variant="ghost" size="sm" onClick={resetAll}>
              Reset all
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FieldPickerProps<TData> {
  columns: Column<TData, unknown>[];
  value: string;
  onChange: (id: string) => void;
}

function FieldPicker<TData>({
  columns,
  value,
  onChange,
}: FieldPickerProps<TData>) {
  const [open, setOpen] = React.useState(false);
  const current = columns.find((c) => c.id === value);
  const label = current?.columnDef.meta?.label ?? current?.id ?? "Select field";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-[160px] shrink-0 justify-start font-normal"
        >
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search field..." />
          <CommandList>
            <CommandEmpty>No field found.</CommandEmpty>
            <CommandGroup>
              {columns.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.columnDef.meta?.label ?? c.id}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  {c.columnDef.meta?.label ?? c.id}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface AddFilterButtonProps<TData> {
  columns: Column<TData, unknown>[];
  onPick: (id: string) => void;
}

function AddFilterButton<TData>({ columns, onPick }: AddFilterButtonProps<TData>) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus />
          Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search field..." />
          <CommandList>
            <CommandEmpty>No field found.</CommandEmpty>
            <CommandGroup>
              {columns.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.columnDef.meta?.label ?? c.id}
                  onSelect={() => {
                    onPick(c.id);
                    setOpen(false);
                  }}
                >
                  {c.columnDef.meta?.label ?? c.id}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ValueInputProps<TData> {
  column: Column<TData, unknown>;
  variant: FilterVariant;
  operator: FilterOperator;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ValueInput<TData>({
  column,
  variant,
  operator,
  value,
  onChange,
}: ValueInputProps<TData>) {
  if (operator === "isEmpty" || operator === "isNotEmpty") {
    return null;
  }

  const meta = column.columnDef.meta;
  const placeholder = meta?.placeholder ?? "Value";

  if (variant === "text") {
    return (
      <Input
        value={(value as string) ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8"
      />
    );
  }

  if (variant === "number") {
    return (
      <Input
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
        className="h-8"
      />
    );
  }

  if (variant === "range") {
    if (operator === "isBetween") {
      const arr = Array.isArray(value) ? (value as (number | undefined)[]) : [];
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={arr[0] === undefined || arr[0] === null ? "" : String(arr[0])}
            placeholder="Min"
            onChange={(e) => {
              const v = e.target.value;
              onChange([v === "" ? undefined : Number(v), arr[1]]);
            }}
            className="h-8"
          />
          <Input
            type="number"
            value={arr[1] === undefined || arr[1] === null ? "" : String(arr[1])}
            placeholder="Max"
            onChange={(e) => {
              const v = e.target.value;
              onChange([arr[0], v === "" ? undefined : Number(v)]);
            }}
            className="h-8"
          />
        </div>
      );
    }
    return (
      <Input
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
        className="h-8"
      />
    );
  }

  if (variant === "date") {
    return (
      <Input
        type="date"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-8"
      />
    );
  }

  if (variant === "dateRange") {
    if (operator === "isBetween") {
      const arr = Array.isArray(value) ? (value as (string | undefined)[]) : [];
      return (
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={arr[0] ?? ""}
            onChange={(e) => onChange([e.target.value || undefined, arr[1]])}
            className="h-8"
          />
          <Input
            type="date"
            value={arr[1] ?? ""}
            onChange={(e) => onChange([arr[0], e.target.value || undefined])}
            className="h-8"
          />
        </div>
      );
    }
    return (
      <Input
        type="date"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-8"
      />
    );
  }

  if (variant === "boolean") {
    const v = value === undefined ? "" : String(value);
    return (
      <Select
        value={v}
        onValueChange={(nv) => onChange(nv === "true")}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (variant === "select") {
    const options = meta?.options ?? [];
    return (
      <Select
        value={(value as string) ?? ""}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (variant === "multiSelect") {
    const options = meta?.options ?? [];
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap items-center gap-2">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label
              key={o.value}
              className="flex items-center gap-1 text-xs"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(c) => {
                  const next = c
                    ? [...selected, o.value]
                    : selected.filter((s) => s !== o.value);
                  onChange(next.length > 0 ? next : undefined);
                }}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    );
  }

  if (variant === "relation" || variant === "multiRelation") {
    const relConfig = meta?.relationConfig;
    if (!relConfig) {
      return (
        <div className="text-xs text-muted-foreground">
          (relation not configured)
        </div>
      );
    }
    const multi = variant === "multiRelation";
    // Stored value: number (single) or number[] (multi).
    const pickerValue = multi
      ? Array.isArray(value)
        ? (value as number[])
        : undefined
      : typeof value === "number"
        ? value
        : undefined;
    return (
      <RelationPicker
        multi={multi}
        value={pickerValue}
        onChange={(v) => onChange(v)}
        queryOptionsFn={relConfig.queryOptionsFn}
        columns={relConfig.columns}
        getLabel={relConfig.getLabel}
        getId={relConfig.getId}
        placeholder={meta?.label ?? column.id}
        variant="field"
        className="w-full"
      />
    );
  }

  return null;
}
