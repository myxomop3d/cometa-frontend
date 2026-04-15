import { useState, useMemo } from "react";
import { Search, Delete } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ButtonGroup } from "@/components/ui/button-group";

interface RelationFilterDropdownProps<T> {
  multi: boolean;
  value: T | T[] | undefined;
  onChange: (value: T | T[] | undefined) => void;
  data: T[];
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  placeholder?: string;
  className?: string;
}

export function RelationFilterDropdown<T>({
  multi,
  value,
  onChange,
  data,
  getLabel,
  getId,
  placeholder = "Select...",
  className,
}: RelationFilterDropdownProps<T>) {
  const [search, setSearch] = useState("");

  const selectedItems: T[] = multi
    ? Array.isArray(value) ? value : []
    : value !== undefined ? [value as T] : [];

  const selectedIds = new Set(selectedItems.map(getId));

  const displayText = selectedItems.length === 0
    ? placeholder
    : multi
      ? `${selectedItems.length} selected`
      : getLabel(selectedItems[0]);

  const hasSelection = selectedItems.length > 0;

  const filtered = useMemo(() => {
    if (!search) return data;
    const lower = search.toLowerCase();
    return data.filter((item) => getLabel(item).toLowerCase().includes(lower));
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
    <div className={className}>
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
            aria-label="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
          >
            <Delete />
          </Button>
        )}
      </ButtonGroup>
    </div>
  );
}
