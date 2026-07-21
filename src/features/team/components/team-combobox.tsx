import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { DebouncedInput } from "@/components/DebouncedInput";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { teamApi } from "@/features/team/api";
import type { TeamDto } from "@/types/api";

interface TeamComboboxProps {
  value: number | null;
  onChange: (teamId: number | null) => void;
}

function teamLabel(team: TeamDto): string {
  return team.name ?? `Team #${team.id}`;
}

export function TeamCombobox({ value, onChange }: TeamComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Server-side search: GET /api/v1/team?$top=20&$filter=contains_ignoring_case(name,...).
  const listQuery = useQuery(teamApi.comboboxQueryOptions(search));
  const teams = listQuery.data?.data ?? [];

  // Selected team may fall outside the top-20 result set — fetch its label by id.
  const detailQuery = useQuery({
    ...teamApi.detailQueryOptions(value as number),
    enabled: value !== null,
  });
  const selected = detailQuery.data?.data;

  const displayText =
    value === null
      ? "Not selected"
      : selected
        ? teamLabel(selected)
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
              placeholder="Search teams…"
              value={search}
              onChange={setSearch}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          <li
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
              value === null ? "bg-accent/50" : ""
            }`}
          >
            <span className="italic text-muted-foreground">Not selected</span>
          </li>
          {teams.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {listQuery.isFetching ? "Loading…" : "No results"}
            </li>
          )}
          {teams.map((team) => {
            const isSelected = team.id === value;
            return (
              <li
                key={team.id}
                onClick={() => {
                  onChange(team.id);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <div className="truncate font-medium">{teamLabel(team)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[team.code != null ? `#${team.code}` : null, team.type]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
