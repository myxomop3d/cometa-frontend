import { useState, useCallback, useEffect } from "react";
import {
  flexRender,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DebouncedInput } from "@/components/DebouncedInput";
import type { EditConfig, EditFieldConfig } from "@/types/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FilterField {
  key: string;
  label: string;
}

interface SimpleTableProps<TData> {
  table: TanStackTable<TData>;

  // Pagination (optional)
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;

  // Filters (optional)
  filterFields?: FilterField[];
  filters?: Record<string, unknown>;
  onFilterChange?: (partial: Record<string, unknown>) => void;

  // Inline editing (optional)
  editConfig?: EditConfig<TData>;

  // Column pinning (optional)
  pinnedLeftColumnId?: string;
}

export function SimpleTable<TData>({
  table,
  page,
  pageCount,
  onPageChange,
  filterFields,
  filters,
  onFilterChange,
  editConfig,
  pinnedLeftColumnId,
}: SimpleTableProps<TData>) {
  const hasPagination =
    page !== undefined && pageCount !== undefined && onPageChange !== undefined;
  const hasFilters =
    filterFields !== undefined &&
    filters !== undefined &&
    onFilterChange !== undefined;

  // Editing state
  const [editingRowId, setEditingRowId] = useState<string | number | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = editingRowId !== null;

  const validate = useCallback(
    (values: Record<string, unknown>): Record<string, string> => {
      if (!editConfig) return {};
      const result = editConfig.schema.safeParse(values);
      if (result.success) return {};
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field !== undefined && !errors[String(field)]) {
          errors[String(field)] = issue.message;
        }
      }
      return errors;
    },
    [editConfig],
  );

  const startEditing = useCallback(
    (row: { original: TData }) => {
      if (!editConfig) return;
      const id = editConfig.rowId(row.original);
      const values: Record<string, unknown> = { ...(row.original as Record<string, unknown>) };
      setFormValues(values);
      setValidationErrors({});
      setEditingRowId(id);
    },
    [editConfig],
  );

  const updateField = useCallback(
    (field: string, value: unknown) => {
      setFormValues((prev) => {
        const next = { ...prev, [field]: value };
        setValidationErrors(validate(next));
        return next;
      });
    },
    [validate],
  );

  const discardEditing = useCallback(() => {
    setEditingRowId(null);
    setFormValues({});
    setValidationErrors({});
    setIsSaving(false);
  }, []);

  const saveEditing = useCallback(async () => {
    if (!editConfig || editingRowId === null) return;

    const errors = validate(formValues);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Find the original row data
    const allRows = table.getRowModel().rows;
    const editingRow = allRows.find(
      (r) => editConfig.rowId(r.original) === editingRowId,
    );
    if (!editingRow) {
      discardEditing();
      return;
    }

    const original = editingRow.original as Record<string, unknown>;

    // Check if any editable fields changed
    const editableKeys = Object.keys(editConfig.fields);
    const hasChanges = editableKeys.some((key) => formValues[key] !== original[key]);
    if (!hasChanges) {
      discardEditing();
      return;
    }

    // Compute only the changed fields
    const changedFields: Partial<TData> = {} as Partial<TData>;
    for (const key of editableKeys) {
      if (formValues[key] !== original[key]) {
        (changedFields as Record<string, unknown>)[key] = formValues[key];
      }
    }

    setIsSaving(true);
    try {
      await editConfig.onSave(editingRowId, changedFields);
      discardEditing();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save changes.";
      toast.error(message);
      setIsSaving(false);
    }
  }, [editConfig, editingRowId, formValues, table, validate, discardEditing]);

  // Escape key discards editing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isEditing) {
        discardEditing();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isEditing, discardEditing]);

  // Renders the editable cell for the currently-editing row
  const renderEditCell = (columnId: string, value: unknown) => {
    if (!editConfig) return null;

    const disabledFields = (editConfig.disabledFields ?? []) as string[];
    if (disabledFields.includes(columnId)) {
      return <span className="text-muted-foreground">{String(value ?? "")}</span>;
    }

    const fieldConfig = (editConfig.fields as Record<string, EditFieldConfig | undefined>)[columnId];
    if (!fieldConfig) {
      return <span className="text-muted-foreground">{String(value ?? "")}</span>;
    }

    const error = validationErrors[columnId];

    if (fieldConfig.type === "text") {
      return (
        <div>
          <Input
            type="text"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) =>
              updateField(columnId, e.target.value === "" ? null : e.target.value)
            }
            className={error ? "border-destructive" : ""}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      );
    }

    if (fieldConfig.type === "number") {
      return (
        <div>
          <Input
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) =>
              updateField(columnId, e.target.value === "" ? null : Number(e.target.value))
            }
            className={error ? "border-destructive" : ""}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      );
    }

    if (fieldConfig.type === "select") {
      return (
        <div>
          <Select
            value={value === null || value === undefined ? "" : String(value)}
            onValueChange={(v) => updateField(columnId, v)}
          >
            <SelectTrigger className={error ? "border-destructive" : ""}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fieldConfig.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      );
    }

    if (fieldConfig.type === "checkbox") {
      return (
        <div>
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) => updateField(columnId, checked)}
            className={error ? "border-destructive" : ""}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "outline" })}>
            Columns
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

      {hasFilters && (
        <div className="grid grid-cols-4 gap-2 my-4">
          {filterFields.map(({ key, label }) => (
            <DebouncedInput
              key={key}
              placeholder={label}
              value={(filters[key] as string) ?? ""}
              onChange={(value) =>
                onFilterChange({ [key]: value || undefined })
              }
            />
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
      <Table style={{ width: table.getCenterTotalSize() }} className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isPinnedLeft = pinnedLeftColumnId === header.column.id;
                return (
                  <TableHead
                    key={header.id}
                    className={`relative ${
                      isPinnedLeft
                        ? "sticky left-0 z-10 bg-background shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                        : ""
                    }`}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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
                );
              })}
              {editConfig && (
                <TableHead
                  style={{ width: 100 }}
                  className="text-center sticky right-0 z-10 bg-background shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                >
                  Actions
                </TableHead>
              )}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const rowId = editConfig ? editConfig.rowId(row.original) : null;
              const isRowEditing = isEditing && rowId === editingRowId;
              const isDimmed = isEditing && !isRowEditing;

              return (
                <TableRow
                  key={row.id}
                  className={
                    isRowEditing
                      ? "ring-2 ring-primary/30 bg-muted/30"
                      : isDimmed
                        ? "opacity-50"
                        : ""
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const isPinnedLeft = pinnedLeftColumnId === cell.column.id;
                    return (
                      <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={
                          isPinnedLeft
                            ? `sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${
                                isRowEditing ? "bg-muted" : "bg-background"
                              }`
                            : ""
                        }
                      >
                        {isRowEditing
                          ? renderEditCell(cell.column.id, formValues[cell.column.id])
                          : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                  {editConfig && (
                    <TableCell
                      className={`text-center sticky right-0 z-10 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)] ${
                        isRowEditing ? "bg-muted" : "bg-background"
                      }`}
                    >
                      {isRowEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={Object.keys(validationErrors).length > 0 || isSaving}
                            onClick={saveEditing}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isSaving}
                            onClick={discardEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isEditing}
                          onClick={() => startEditing(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getAllColumns().length + (editConfig ? 1 : 0)}
                className="h-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>

      {hasPagination && (
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
