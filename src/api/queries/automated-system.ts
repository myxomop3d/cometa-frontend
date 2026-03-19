import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { fetchAutomatedSystems } from "@/api/automated-system";
import type { AutomatedSystemFilters } from "@/types/api";

export function automatedSystemsQueryOptions(filters: AutomatedSystemFilters = {}) {
  return queryOptions({
    queryKey: ["automated-systems", filters],
    queryFn: () => fetchAutomatedSystems(filters),
    placeholderData: keepPreviousData,
  });
}
