import { getRouteApi } from "@tanstack/react-router";
import type {
  RegisteredRouter,
  RouteIds,
  SearchParamOptions,
} from "@tanstack/react-router";
import { cleanEmptyParams } from "@/lib/cleanEmptyParams";

export function useFilters<
  TId extends RouteIds<RegisteredRouter["routeTree"]>,
  TSearchParams extends SearchParamOptions<
    RegisteredRouter,
    TId,
    TId
  >["search"],
>(routeId: TId) {
  const routeApi = getRouteApi<TId>(routeId);
  const navigate = routeApi.useNavigate();
  const filters = routeApi.useSearch();

  function setFilters(partial: Partial<TSearchParams>) {
    navigate({
      search: cleanEmptyParams({
        ...filters,
        page: 1,
        ...partial,
      }) as TSearchParams,
    });
  }

  function setPage(page: number) {
    navigate({
      search: cleanEmptyParams({
        ...filters,
        page,
      }) as TSearchParams,
    });
  }

  function resetFilters() {
    navigate({ search: {} as TSearchParams });
  }

  return { filters, setFilters, setPage, resetFilters };
}
