import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { DebouncedInput } from "@/components/DebouncedInput";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { automatedSystemApi } from "@/features/automated-system/api";

interface AutomatedSystemComboboxProps {
  value: number | null;
  onChange: (automatedSystemId: number | null) => void;
}

/** Modeled on PersonCombobox. Id 0 ("Not set") is an ordinary option. */
export function AutomatedSystemCombobox({ value, onChange }: AutomatedSystemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Server-side search: GET /api/v1/automated-system?$top=20&$filter=contains_ignoring_case(name, …).
  const listQuery = useQuery(automatedSystemApi.comboboxQueryOptions(search));
  const systems = listQuery.data?.data ?? [];

  // The selected system may fall outside the top-20 result set — fetch by id.
  const detailQuery = useQuery({
    ...automatedSystemApi.detailQueryOptions(value ?? 0),
    enabled: value !== null,
  });
  const selected = detailQuery.data?.data;

  const displayText =
    value === null
      ? "Not selected"
      : selected
        ? selected.name
        : detailQuery.isLoading
          ? "Loading…"
          : "Not selected";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-left font-normal"
          />
        }
      >
        <span className="truncate">{displayText}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <DebouncedInput
              placeholder="Search automated systems…"
              value={search}
              onChange={setSearch}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          {systems.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {listQuery.isFetching ? "Loading…" : "No results"}
            </li>
          )}
          {systems.map((system) => {
            const isSelected = system.id === value;
            return (
              <li
                key={system.id}
                onClick={() => {
                  onChange(system.id);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <div className="truncate font-medium">{system.name}</div>
                {system.ci && (
                  <div className="truncate text-xs text-muted-foreground">{system.ci}</div>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
