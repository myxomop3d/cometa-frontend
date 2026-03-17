import { queryOptions } from "@tanstack/react-query";
import { fetchAutomatedSystems } from "@/api/automated-system";

export function automatedSystemsQueryOptions() {
  return queryOptions({
    queryKey: ["automated-systems"],
    queryFn: fetchAutomatedSystems,
  });
}
