import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { DebouncedInput } from "@/components/DebouncedInput";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { flowApi } from "@/features/flow/api";

interface FlowComboboxProps {
  value?: number;
  onChange: (flowId: number) => void;
}

export function FlowCombobox({ value, onChange }: FlowComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Server-side search: GET /api/v1/flow?$top=20&$filter=contains_ignoring_case(...).
  const listQuery = useQuery(flowApi.comboboxQueryOptions(search));
  const flows = listQuery.data?.data ?? [];

  // The selected flow may fall outside the top-20 result set, so fetch its
  // label directly by id.
  const detailQuery = useQuery({
    ...flowApi.detailQueryOptions(value as number),
    enabled: value !== undefined,
  });
  const selected = detailQuery.data?.data;

  const displayText = selected
    ? selected.caption
    : value !== undefined && detailQuery.isLoading
      ? "Loading…"
      : "Select a flow";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="min-w-[280px] justify-start text-left font-normal"
          />
        }
      >
        <span className="truncate">{displayText}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <DebouncedInput
              placeholder="Search by caption or key…"
              value={search}
              onChange={setSearch}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          {flows.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {listQuery.isFetching ? "Loading…" : "No results"}
            </li>
          )}
          {flows.map((flow) => {
            const isSelected = flow.id === value;
            return (
              <li
                key={flow.id}
                onClick={() => {
                  onChange(flow.id);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <div className="truncate font-medium">{flow.caption}</div>
                <div className="truncate text-xs text-muted-foreground">{flow.key}</div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
