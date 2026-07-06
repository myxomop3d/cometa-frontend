import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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

  // Bare GET /api/v1/flow returns the complete list; filtering happens
  // client-side because the backend has no filter params. The selected
  // flow's label is derived from the same list — no per-flow request.
  const listQuery = useQuery(flowApi.listQueryOptions());

  const allFlows = listQuery.data?.data;
  const flows = useMemo(() => {
    if (!allFlows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return allFlows;
    return allFlows.filter(
      (f) =>
        f.caption.toLowerCase().includes(q) || f.code.toLowerCase().includes(q),
    );
  }, [allFlows, search]);

  const selected =
    value !== undefined ? allFlows?.find((f) => f.id === value) : undefined;
  const displayText = selected
    ? selected.caption
    : listQuery.isLoading
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
            <Input
              placeholder="Search by caption or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          {flows.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {listQuery.isLoading ? "Loading…" : "No results"}
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
                <div className="truncate text-xs text-muted-foreground">{flow.code}</div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
