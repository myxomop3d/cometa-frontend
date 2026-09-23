import { afterEach, describe, expect, it, vi } from "vitest";
import { createCrudApi } from "./create-crud-api";

const BASE = "nodeAggrType eq 'MICROSERVICE_NAME_AGGR'";

function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ count: 0, data: [], messages: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentParams(fetchMock: ReturnType<typeof stubFetch>): URLSearchParams {
  const url = String(fetchMock.mock.calls[0]![0]);
  return new URLSearchParams(url.slice(url.indexOf("?") + 1));
}

function makeApi(baseFilter?: string) {
  return createCrudApi<{ id: number }, Record<string, unknown>, object>({
    basePath: "/api/v1/thing",
    listPath: "/api/v1/thing/graph",
    queryKey: ["thing"],
    filterDescriptors: [
      { id: "name", variant: "text" },
      { id: "teams", variant: "multiRelation" },
    ],
    staticParams: { $fields: "nodes" },
    baseFilter,
  });
}

const page = { page: 1, pageSize: 20, sort: undefined };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createCrudApi baseFilter", () => {
  it("sends the base filter alone when no column filter is set", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchDataTable({ ...page, columnFilters: [] });
    expect(sentParams(fetchMock).get("$filter")).toBe(BASE);
  });

  it("puts the base filter first and parenthesizes the built filter", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchDataTable({
      ...page,
      columnFilters: [{ id: "name", value: "pos" }],
    });
    expect(sentParams(fetchMock).get("$filter")).toBe(
      `${BASE} and (contains_ignoring_case(name, 'pos'))`,
    );
  });

  it("keeps a collection any() lambda last", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchDataTable({
      ...page,
      columnFilters: [
        { id: "teams", value: [1, 2] },
        { id: "name", value: "pos" },
      ],
    });
    const filter = sentParams(fetchMock).get("$filter")!;
    expect(filter.startsWith(`${BASE} and (contains_ignoring_case(name, 'pos') and `)).toBe(true);
    expect(filter).toMatch(/any\([^)]*\)\)\)$/);
  });

  it("is not overwritten by staticParams", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchDataTable({ ...page, columnFilters: [] });
    const params = sentParams(fetchMock);
    expect(params.get("$fields")).toBe("nodes");
    expect(params.get("$filter")).toBe(BASE);
  });

  it("applies to fetchList, combined with a caller $filter", async () => {
    const fetchMock = stubFetch();
    await makeApi(BASE).fetchList({ $filter: "id eq 5" });
    expect(sentParams(fetchMock).get("$filter")).toBe(`${BASE} and (id eq 5)`);
  });

  it("changes nothing when baseFilter is not set", async () => {
    const fetchMock = stubFetch();
    await makeApi().fetchDataTable({
      ...page,
      columnFilters: [{ id: "name", value: "pos" }],
    });
    expect(sentParams(fetchMock).get("$filter")).toBe(
      "contains_ignoring_case(name, 'pos')",
    );
  });
});
