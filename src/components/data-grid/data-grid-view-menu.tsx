import type { Table } from "@tanstack/react-table";
import { ColumnsIcon } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

interface DataGridViewMenuProps<TData> {
  table: Table<TData>;
}

export function DataGridViewMenu<TData>({
  table,
}: DataGridViewMenuProps<TData>) {
  const columns = table
    .getAllColumns()
    .filter((column) => column.getCanHide());

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="gap-1" />}
      >
        <ColumnsIcon className="size-3.5" />
        Columns
      </PopoverTrigger>
      <PopoverContent className="w-50 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() =>
                    column.toggleVisibility(!column.getIsVisible())
                  }
                >
                  <Checkbox
                    checked={column.getIsVisible()}
                    className="mr-2"
                  />
                  {column.columnDef.meta?.label ?? column.id}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
