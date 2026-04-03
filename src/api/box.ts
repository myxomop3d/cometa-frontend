import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import type { ColumnFiltersState } from "@tanstack/react-table";
import type { ApiResponse, BoxDto, BoxFilters } from "@/types/api";

const BASE = "/api/v1/box";

const STRING_FILTER_FIELDS = ["name", "objectCode"] as const;

function buildListParams(filters: BoxFilters): URLSearchParams {
  const { page = 1, pageSize = 20, ...rest } = filters;
  const params = new URLSearchParams();
  params.set("$skip", String((page - 1) * pageSize));
  params.set("$top", String(pageSize));

  const clauses: string[] = [];

  for (const f of STRING_FILTER_FIELDS) {
    if (rest[f]) {
      clauses.push(
        `contains_ignoring_case(${f},'${String(rest[f]).replace(/'/g, "''")}')`
      );
    }
  }

  if (rest.tags) {
    clauses.push(
      `tags/any(t: contains_ignoring_case(t,'${rest.tags.replace(/'/g, "''")}'))`
    );
  }

  if (rest.shape) {
    clauses.push(`shape eq '${rest.shape}'`);
  }

  if (rest.numMin !== undefined) {
    clauses.push(`num ge ${rest.numMin}`);
  }
  if (rest.numMax !== undefined) {
    clauses.push(`num le ${rest.numMax}`);
  }

  if (rest.checkbox !== undefined) {
    clauses.push(`checkbox eq ${rest.checkbox}`);
  }

  if (rest.dateStrFrom) {
    clauses.push(`dateStr ge '${rest.dateStrFrom}'`);
  }
  if (rest.dateStrTo) {
    clauses.push(`dateStr le '${rest.dateStrTo}'`);
  }

  if (rest.itemId !== undefined) {
    clauses.push(`item/id eq ${rest.itemId}`);
  }

  if (rest.thingIds && rest.thingIds.length > 0) {
    const inner = rest.thingIds.map((id) => `t/id eq ${id}`).join(" or ");
    clauses.push(`things/any(t: ${inner})`);
  }

  if (rest.oldItemId !== undefined) {
    clauses.push(`oldItem/id eq ${rest.oldItemId}`);
  }

  if (rest.oldThingIds && rest.oldThingIds.length > 0) {
    const inner = rest.oldThingIds.map((id) => `t/id eq ${id}`).join(" or ");
    clauses.push(`oldThings/any(t: ${inner})`);
  }

  if (clauses.length > 0) {
    params.set("$filter", clauses.join(" and "));
  }
  return params;
}

export async function fetchBoxes(
  filters: BoxFilters = {},
): Promise<ApiResponse<BoxDto[]>> {
  const params = buildListParams(filters);
  const response = await fetch(`${BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch boxes: ${response.status}`);
  }
  return response.json();
}

export async function fetchBox(
  id: number,
): Promise<ApiResponse<BoxDto>> {
  const response = await fetch(`${BASE}/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch box ${id}: ${response.status}`);
  }
  return response.json();
}

export async function patchBox(
  id: number,
  data: Partial<BoxDto>,
): Promise<ApiResponse<BoxDto>> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to patch box ${id}: ${response.status}`);
  }
  return response.json();
}

export function boxesQueryOptions(filters: BoxFilters = {}) {
  return queryOptions({
    queryKey: ["boxes", "list", filters],
    queryFn: () => fetchBoxes(filters),
    placeholderData: keepPreviousData,
  });
}

export function boxQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["boxes", "detail", id],
    queryFn: () => fetchBox(id),
  });
}

function buildDataTableParams(params: {
  page: number;
  pageSize: number;
  columnFilters: ColumnFiltersState;
  sort?: string;
  columns: { id: string; meta?: { variant?: string; filterKey?: string; filterKeys?: [string, string] } }[];
}): URLSearchParams {
  const searchParams = new URLSearchParams();
  const { page, pageSize, columnFilters, sort, columns } = params;

  searchParams.set("$skip", String((page - 1) * pageSize));
  searchParams.set("$top", String(pageSize));

  const filterClauses: string[] = [];

  for (const filter of columnFilters) {
    const col = columns.find((c) => c.id === filter.id);
    const meta = col?.meta;
    if (!meta) continue;

    const value = filter.value;

    switch (meta.variant) {
      case "text":
        if (typeof value === "string" && value.length > 0) {
          filterClauses.push(
            `contains_ignoring_case(${filter.id}, '${value}')`,
          );
        }
        break;

      case "number":
        if (typeof value === "string" && value.length > 0) {
          filterClauses.push(`${filter.id} eq ${value}`);
        }
        break;

      case "range": {
        const [minVal, maxVal] = (value as [unknown, unknown]) ?? [];
        if (minVal !== undefined && minVal !== null)
          filterClauses.push(`${filter.id} ge ${minVal}`);
        if (maxVal !== undefined && maxVal !== null)
          filterClauses.push(`${filter.id} le ${maxVal}`);
        break;
      }

      case "dateRange": {
        const [fromVal, toVal] = (value as [unknown, unknown]) ?? [];
        if (fromVal)
          filterClauses.push(`${filter.id} ge '${fromVal}'`);
        if (toVal)
          filterClauses.push(`${filter.id} le '${toVal}'`);
        break;
      }

      case "date":
        if (value) {
          const d = new Date(value as number);
          if (!isNaN(d.getTime())) {
            filterClauses.push(`${filter.id} eq '${d.toISOString().slice(0, 10)}'`);
          }
        }
        break;

      case "select":
      case "multiSelect": {
        const vals = Array.isArray(value) ? value : [];
        if (vals.length === 1) {
          filterClauses.push(`${filter.id} eq '${vals[0]}'`);
        } else if (vals.length > 1) {
          const inClause = vals.map((v) => `'${v}'`).join(",");
          filterClauses.push(`${filter.id} in (${inClause})`);
        }
        break;
      }

      case "boolean": {
        const boolVals = Array.isArray(value) ? value : [];
        if (boolVals.length === 1) {
          filterClauses.push(`${filter.id} eq ${boolVals[0]}`);
        }
        break;
      }

      case "relation": {
        const relId = value as number | undefined;
        if (relId !== undefined) {
          filterClauses.push(`${filter.id}/id eq ${relId}`);
        }
        break;
      }

      case "multiRelation": {
        const relIds = value as number[] | undefined;
        if (relIds && relIds.length > 0) {
          const idList = relIds.join(",");
          filterClauses.push(
            `${filter.id}/any(x: x/id in (${idList}))`,
          );
        }
        break;
      }
    }
  }

  if (filterClauses.length > 0) {
    searchParams.set("$filter", filterClauses.join(" and "));
  }

  if (sort) {
    const orderby = sort
      .split(",")
      .map((part) => {
        const [field, dir] = part.split(".");
        return `${field} ${dir}`;
      })
      .join(",");
    searchParams.set("$orderby", orderby);
  }

  return searchParams;
}

export function boxDiceQueryOptions(params: {
  page: number;
  pageSize: number;
  columnFilters: ColumnFiltersState;
  sort?: string;
  columns: { id: string; meta?: { variant?: string; filterKey?: string; filterKeys?: [string, string] } }[];
}) {
  return {
    queryKey: ["boxes", "dice", params.page, params.pageSize, params.columnFilters, params.sort],
    queryFn: async (): Promise<ApiResponse<BoxDto[]>> => {
      const searchParams = buildDataTableParams(params);
      const res = await fetch(`/api/v1/box?${searchParams.toString()}`);
      return res.json();
    },
    placeholderData: keepPreviousData,
  };
}

export async function createBox(
  data: Partial<BoxDto>,
): Promise<BoxDto> {
  const res = await fetch("/api/v1/box", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
