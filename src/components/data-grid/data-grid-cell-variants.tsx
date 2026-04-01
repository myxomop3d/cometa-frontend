import { useCallback, useEffect, useRef, useState } from "react";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDateForDisplay,
  formatDateToString,
  parseLocalDate,
} from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type { DataGridCellProps } from "@/types/data-grid";

// ── ShortTextCell ──

export function ShortTextCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const initialValue = cell.getValue() as string;
  const [value, setValue] = useState(initialValue);
  const cellRef = useRef<HTMLDivElement>(null);
  const prevIsEditingRef = useRef(false);

  const prevInitialValueRef = useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue);
    if (cellRef.current && !isEditing) {
      cellRef.current.textContent = initialValue;
    }
  }

  const onBlur = useCallback(() => {
    const currentValue = cellRef.current?.textContent ?? "";
    if (!readOnly && currentValue !== initialValue) {
      tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: currentValue });
    }
    tableMeta?.onCellEditingStop?.();
  }, [tableMeta, rowIndex, columnId, initialValue, readOnly]);

  const onInput = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      setValue(event.currentTarget.textContent ?? "");
    },
    [],
  );

  const onWrapperKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          const currentValue = cellRef.current?.textContent ?? "";
          if (currentValue !== initialValue) {
            tableMeta?.onDataUpdate?.({
              rowIndex,
              columnId,
              value: currentValue,
            });
          }
          tableMeta?.onCellEditingStop?.({ moveToNextRow: true });
        } else if (event.key === "Tab") {
          event.preventDefault();
          const currentValue = cellRef.current?.textContent ?? "";
          if (currentValue !== initialValue) {
            tableMeta?.onDataUpdate?.({
              rowIndex,
              columnId,
              value: currentValue,
            });
          }
          tableMeta?.onCellEditingStop?.({
            direction: event.shiftKey ? "left" : "right",
          });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          cellRef.current?.blur();
        }
      } else if (
        isFocused &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        setValue(event.key);
        queueMicrotask(() => {
          if (cellRef.current && cellRef.current.contentEditable === "true") {
            cellRef.current.textContent = event.key;
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(cellRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        });
      }
    },
    [isEditing, isFocused, initialValue, tableMeta, rowIndex, columnId],
  );

  useEffect(() => {
    const wasEditing = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;
    if (isEditing && !wasEditing && cellRef.current) {
      cellRef.current.focus();
      if (!cellRef.current.textContent && value) {
        cellRef.current.textContent = value;
      }
      if (cellRef.current.textContent) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(cellRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [isEditing, value]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
      onKeyDown={onWrapperKeyDown}
    >
      <div
        role="textbox"
        contentEditable={isEditing}
        tabIndex={-1}
        ref={cellRef}
        onBlur={onBlur}
        onInput={onInput}
        suppressContentEditableWarning
        className={cn(
          "size-full overflow-hidden outline-none",
          isEditing && "cursor-text",
          !isEditing && "truncate",
        )}
      >
        {!isEditing ? (value ?? "") : ""}
      </div>
    </DataGridCellWrapper>
  );
}

// ── NumberCell ──

export function NumberCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const min = cellOpts?.variant === "number" ? cellOpts.min : undefined;
  const max = cellOpts?.variant === "number" ? cellOpts.max : undefined;
  const step = cellOpts?.variant === "number" ? cellOpts.step : undefined;

  const initialValue = cell.getValue() as number | null;
  const [value, setValue] = useState<string>(
    initialValue != null ? String(initialValue) : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const prevInitialValueRef = useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue != null ? String(initialValue) : "");
  }

  const saveAndStop = useCallback(
    (opts?: { direction?: "left" | "right"; moveToNextRow?: boolean }) => {
      const numVal = value === "" ? null : Number(value);
      if (numVal !== initialValue) {
        tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: numVal });
      }
      tableMeta?.onCellEditingStop?.(opts);
    },
    [value, initialValue, tableMeta, rowIndex, columnId],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          saveAndStop({ moveToNextRow: true });
        } else if (event.key === "Tab") {
          event.preventDefault();
          saveAndStop({ direction: event.shiftKey ? "left" : "right" });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue != null ? String(initialValue) : "");
          tableMeta?.onCellEditingStop?.();
        }
      }
    },
    [isEditing, saveAndStop, initialValue, tableMeta],
  );

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      readOnly={readOnly}
      onKeyDown={onKeyDown}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => saveAndStop()}
          className="size-full bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <span className="truncate">{initialValue ?? ""}</span>
      )}
    </DataGridCellWrapper>
  );
}

// ── CheckboxCell ──

export function CheckboxCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const value = cell.getValue() as boolean;

  const onToggle = useCallback(() => {
    if (readOnly) return;
    tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: !value });
  }, [readOnly, tableMeta, rowIndex, columnId, value]);

  return (
    <DataGridCellWrapper
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={false}
      isFocused={isFocused}
      readOnly={readOnly}
    >
      <Checkbox
        checked={value}
        onCheckedChange={onToggle}
        disabled={readOnly}
        className="mx-auto"
      />
    </DataGridCellWrapper>
  );
}

// ── SelectCell ──

export function SelectCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options = cellOpts?.variant === "select" ? cellOpts.options : [];
  const initialValue = cell.getValue() as string;

  const onValueChange = useCallback(
    (newValue: string) => {
      if (newValue !== initialValue) {
        tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: newValue });
      }
      tableMeta?.onCellEditingStop?.();
    },
    [initialValue, tableMeta, rowIndex, columnId],
  );

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
      {isEditing ? (
        <Select
          value={initialValue}
          onValueChange={onValueChange}
          open={isEditing}
          onOpenChange={(open) => {
            if (!open) tableMeta?.onCellEditingStop?.();
          }}
        >
          <SelectTrigger className="h-full border-0 shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent data-grid-cell-editor>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="truncate">
          {options.find((o) => o.value === initialValue)?.label ?? initialValue}
        </span>
      )}
    </DataGridCellWrapper>
  );
}

// ── MultiSelectCell ──

export function MultiSelectCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options =
    cellOpts?.variant === "multi-select" ? cellOpts.options : [];
  const initialValue = (cell.getValue() as string[]) ?? [];
  const [selected, setSelected] = useState<string[]>(initialValue);

  const prevRef = useRef(initialValue);
  if (initialValue !== prevRef.current) {
    prevRef.current = initialValue;
    setSelected(initialValue);
  }

  const onToggle = useCallback((value: string) => {
    setSelected((prev) => {
      const next = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value];
      return next;
    });
  }, []);

  const onApply = useCallback(() => {
    if (JSON.stringify(selected) !== JSON.stringify(initialValue)) {
      tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: selected });
    }
    tableMeta?.onCellEditingStop?.();
  }, [selected, initialValue, tableMeta, rowIndex, columnId]);

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
              initialValue.map((v) => (
                <Badge key={v} variant="secondary" className="text-xs">
                  {options.find((o) => o.value === v)?.label ?? v}
                </Badge>
              ))
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          data-grid-cell-editor
          className="w-50 p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => onToggle(opt.value)}
                  >
                    <Checkbox
                      checked={selected.includes(opt.value)}
                      className="mr-2"
                    />
                    {opt.label}
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

// ── DateCell ──

export function DateCell<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  readOnly,
}: DataGridCellProps<TData>) {
  const initialValue = cell.getValue() as string;
  const date = parseLocalDate(initialValue);

  const onSelect = useCallback(
    (newDate: Date | undefined) => {
      if (!newDate) return;
      const dateStr = formatDateToString(newDate);
      if (dateStr !== initialValue) {
        tableMeta?.onDataUpdate?.({ rowIndex, columnId, value: dateStr });
      }
      tableMeta?.onCellEditingStop?.();
    },
    [initialValue, tableMeta, rowIndex, columnId],
  );

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
            {formatDateForDisplay(initialValue)}
          </span>
        </PopoverAnchor>
        <PopoverContent
          data-grid-cell-editor
          className="w-auto p-0"
          align="start"
        >
          <Calendar
            mode="single"
            selected={date ?? undefined}
            onSelect={onSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </DataGridCellWrapper>
  );
}
