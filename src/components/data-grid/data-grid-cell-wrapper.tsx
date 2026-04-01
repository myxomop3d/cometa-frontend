import { forwardRef, useCallback } from "react";
import { useComposedRefs } from "@/lib/compose-refs";
import { getCellKey } from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type { DataGridCellProps } from "@/types/data-grid";

interface DataGridCellWrapperProps<TData>
  extends DataGridCellProps<TData>,
    Omit<React.ComponentProps<"div">, "children"> {
  children: React.ReactNode;
}

function DataGridCellWrapperInner<TData>(
  {
    tableMeta,
    rowIndex,
    columnId,
    isEditing,
    isFocused,
    readOnly,
    className,
    onClick: onClickProp,
    onKeyDown: onKeyDownProp,
    children,
    // Consume these so they don't spread to the div
    cell: _cell,
    ...props
  }: DataGridCellWrapperProps<TData>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const cellMapRef = tableMeta?.cellMapRef;

  const onCellChange = useCallback(
    (node: HTMLDivElement | null) => {
      if (!cellMapRef) return;
      const cellKey = getCellKey(rowIndex, columnId);
      if (node) {
        cellMapRef.current.set(cellKey, node);
      } else {
        cellMapRef.current.delete(cellKey);
      }
    },
    [rowIndex, columnId, cellMapRef],
  );

  const composedRef = useComposedRefs(ref, onCellChange);

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isEditing) {
        event.preventDefault();
        onClickProp?.(event);
        if (isFocused && !readOnly) {
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
        } else {
          tableMeta?.onCellClick?.(rowIndex, columnId, event);
        }
      }
    },
    [
      tableMeta,
      rowIndex,
      columnId,
      isEditing,
      isFocused,
      readOnly,
      onClickProp,
    ],
  );

  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isEditing && !readOnly) {
        event.preventDefault();
        tableMeta?.onCellDoubleClick?.(rowIndex, columnId);
      }
    },
    [tableMeta, rowIndex, columnId, isEditing, readOnly],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDownProp?.(event);

      if (event.defaultPrevented) return;

      if (!isEditing && isFocused && !readOnly) {
        if (
          event.key === "F2" ||
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
        } else if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
        }
      }
    },
    [
      isEditing,
      isFocused,
      readOnly,
      tableMeta,
      rowIndex,
      columnId,
      onKeyDownProp,
    ],
  );

  return (
    <div
      ref={composedRef}
      role="gridcell"
      tabIndex={isFocused ? 0 : -1}
      data-row-index={rowIndex}
      data-column-id={columnId}
      data-editing={isEditing || undefined}
      data-focused={isFocused || undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        "flex h-full items-center border-b border-r px-2 text-sm outline-none",
        isFocused && "ring-2 ring-ring ring-inset",
        isEditing && "ring-2 ring-primary ring-inset",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const DataGridCellWrapper = forwardRef(DataGridCellWrapperInner) as <
  TData,
>(
  props: DataGridCellWrapperProps<TData> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement;
