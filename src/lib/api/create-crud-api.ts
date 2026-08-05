import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ColumnFiltersState } from "@tanstack/react-table";
import type { ApiResponse, AppMessage } from "@/types/api";
import {
  buildFilterParams,
  type FilterDescriptor,
} from "@/lib/odata/build-filter-params";

export class ApiError extends Error {
  readonly status: number;
  readonly messages: AppMessage[];
  constructor(message: string, status: number, messages: AppMessage[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.messages = messages;
  }
}

export async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  let body: unknown = undefined;
  // 204 No Content (and other empty bodies) have no JSON to parse.
  const hasBody =
    res.status !== 204 && res.headers.get("content-length") !== "0";
  if (hasBody) {
    try {
      body = await res.json();
    } catch {
      // non-JSON body
    }
  }
  if (!res.ok) {
    const messages =
      body && typeof body === "object" && "messages" in body
        ? ((body as ApiResponse<unknown>).messages ?? [])
        : [];
    const firstE = messages.find((m) => m.semantic === "E");
    throw new ApiError(
      firstE?.message ?? `Request failed: ${res.status}`,
      res.status,
      messages,
    );
  }
  return body as T;
}

export interface DataTableQueryParams {
  page: number;
  pageSize: number;
  sort?: string;
  columnFilters: ColumnFiltersState;
}

export interface CreateCrudApiOptions {
  basePath: string;
  /** Path used for list reads (`fetchList` / `fetchDataTable`) only.
   *  Defaults to `basePath`. Use this when the list needs to hit a
   *  read-only entity-graph endpoint (e.g. `/api/v1/team/graph`) while
   *  `create`/`patch`/`fetchOne`/`remove` keep targeting `basePath`. */
  listPath?: string;
  /** Root queryKey, e.g. `["boxes"]`. Sub-keys are appended per operation. */
  queryKey: readonly unknown[];
  /** Filter descriptors used by dataTableQueryOptions. */
  filterDescriptors: readonly FilterDescriptor[];
  /** Query params appended to every list request, e.g. `{ "$fields": "leader" }`
   *  to make the backend eager-fetch a relation via its entity graph. */
  staticParams?: Record<string, string>;
}

export function createCrudApi<
  TDto extends { id: number },
  TFilters extends object,
  TWritePayload,
>({ basePath, listPath, queryKey, filterDescriptors, staticParams }: CreateCrudApiOptions) {
  const resolvedListPath = listPath ?? basePath;

  async function fetchList(
    filters: TFilters = {} as TFilters,
  ): Promise<ApiResponse<TDto[]>> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        if (v.length > 0) params.set(k, v.join(","));
      } else {
        params.set(k, String(v));
      }
    }
    for (const [k, v] of Object.entries(staticParams ?? {})) {
      params.set(k, v);
    }
    return apiFetch<ApiResponse<TDto[]>>(`${resolvedListPath}?${params}`);
  }

  async function fetchOne(id: number): Promise<ApiResponse<TDto>> {
    return apiFetch<ApiResponse<TDto>>(`${basePath}/${id}`);
  }

  async function create(
    data: TWritePayload,
  ): Promise<ApiResponse<TDto>> {
    return apiFetch<ApiResponse<TDto>>(basePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function patch(
    id: number,
    data: Partial<TWritePayload>,
  ): Promise<ApiResponse<TDto>> {
    return apiFetch<ApiResponse<TDto>>(`${basePath}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function remove(id: number): Promise<void> {
    await apiFetch<void>(`${basePath}/${id}`, { method: "DELETE" });
  }

  async function fetchDataTable(
    params: DataTableQueryParams,
  ): Promise<ApiResponse<TDto[]>> {
    const searchParams = buildFilterParams({
      ...params,
      descriptors: filterDescriptors,
    });
    for (const [k, v] of Object.entries(staticParams ?? {})) {
      searchParams.set(k, v);
    }
    return apiFetch<ApiResponse<TDto[]>>(
      `${resolvedListPath}?${searchParams.toString()}`,
    );
  }

  function listQueryOptions(filters: TFilters = {} as TFilters) {
    return queryOptions({
      queryKey: [...queryKey, "list", filters] as const,
      queryFn: () => fetchList(filters),
      placeholderData: keepPreviousData,
    });
  }

  function detailQueryOptions(id: number) {
    return queryOptions({
      queryKey: [...queryKey, "detail", id] as const,
      queryFn: () => fetchOne(id),
    });
  }

  function dataTableQueryOptions(params: DataTableQueryParams) {
    return queryOptions({
      queryKey: [
        ...queryKey,
        "table",
        params.page,
        params.pageSize,
        params.sort,
        params.columnFilters,
      ] as const,
      queryFn: () => fetchDataTable(params),
      placeholderData: keepPreviousData,
    });
  }

  return {
    fetchList,
    fetchOne,
    create,
    patch,
    remove,
    listQueryOptions,
    detailQueryOptions,
    dataTableQueryOptions,
  };
}
