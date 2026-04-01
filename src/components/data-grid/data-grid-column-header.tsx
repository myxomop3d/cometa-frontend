import type { Column } from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  EyeOffIcon,
  PinIcon,
  PinOffIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataGridColumnHeaderProps<TData> {
  column: Column<TData, unknown>;
  title: string;
  sortDirection?: "asc" | "desc" | false;
  onSort?: (columnId: string, direction: "asc" | "desc") => void;
}

export function DataGridColumnHeader<TData>({
  column,
  title,
  sortDirection,
  onSort,
}: DataGridColumnHeaderProps<TData>) {
  const isPinned = column.getIsPinned();

  return (
    <div className="flex w-full items-center justify-between gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 gap-1 text-xs font-medium data-[state=open]:bg-accent"
          >
            <span className="truncate">{title}</span>
            {sortDirection === "asc" ? (
              <ArrowUpIcon className="size-3.5" />
            ) : sortDirection === "desc" ? (
              <ArrowDownIcon className="size-3.5" />
            ) : (
              <ChevronsUpDownIcon className="size-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onSort?.(column.id, "asc")}>
            <ArrowUpIcon className="mr-2 size-3.5 text-muted-foreground" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSort?.(column.id, "desc")}>
            <ArrowDownIcon className="mr-2 size-3.5 text-muted-foreground" />
            Desc
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isPinned !== "left" && (
            <DropdownMenuItem onClick={() => column.pin("left")}>
              <PinIcon className="mr-2 size-3.5 text-muted-foreground" />
              Pin Left
            </DropdownMenuItem>
          )}
          {isPinned !== "right" && (
            <DropdownMenuItem onClick={() => column.pin("right")}>
              <PinIcon className="mr-2 size-3.5 text-muted-foreground rotate-90" />
              Pin Right
            </DropdownMenuItem>
          )}
          {isPinned && (
            <DropdownMenuItem onClick={() => column.pin(false)}>
              <PinOffIcon className="mr-2 size-3.5 text-muted-foreground" />
              Unpin
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOffIcon className="mr-2 size-3.5 text-muted-foreground" />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
