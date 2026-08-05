import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { DebouncedInput } from "@/components/DebouncedInput";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { personApi } from "@/features/person/api";
import type { PersonDto } from "@/types/api";

interface PersonComboboxProps {
  value: number | null;
  onChange: (personId: number | null) => void;
}

export function personLabel(person: PersonDto): string {
  const full = [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(" ");
  return full || person.email || `Person #${person.id}`;
}

export function PersonCombobox({ value, onChange }: PersonComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Server-side search: GET /api/v1/person?$top=20&$filter=contains_ignoring_case(...).
  const listQuery = useQuery(personApi.comboboxQueryOptions(search));
  const persons = listQuery.data?.data ?? [];

  // Selected person may fall outside the top-20 result set — fetch by id.
  const detailQuery = useQuery({
    ...personApi.detailQueryOptions(value as number),
    enabled: value !== null,
  });
  const selected = detailQuery.data?.data;

  const displayText =
    value === null
      ? "Not selected"
      : selected
        ? personLabel(selected)
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
              placeholder="Search persons…"
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
          {persons.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {listQuery.isFetching ? "Loading…" : "No results"}
            </li>
          )}
          {persons.map((person) => {
            const isSelected = person.id === value;
            return (
              <li
                key={person.id}
                onClick={() => {
                  onChange(person.id);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <div className="truncate font-medium">{personLabel(person)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {person.email}
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
