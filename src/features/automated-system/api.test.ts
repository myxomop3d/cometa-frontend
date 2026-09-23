import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAutomatedSystemsFiltered } from "./api";

function lastUrl(spy: ReturnType<typeof vi.fn>): URL {
  return new URL(String(spy.mock.calls.at(-1)![0]), "http://x");
}

describe("fetchAutomatedSystemsFiltered", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub() {
    const spy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], messages: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", spy);
    return spy;
  }

  it("pages with $skip/$top and searches by name", async () => {
    const spy = stub();
    await fetchAutomatedSystemsFiltered({ name: "gm'sb", page: 2, pageSize: 20 });
    const url = lastUrl(spy);
    expect(url.pathname).toBe("/api/v1/automated-system");
    expect(url.searchParams.get("$skip")).toBe("20");
    expect(url.searchParams.get("$top")).toBe("20");
    expect(url.searchParams.get("$filter")).toBe("contains_ignoring_case(name, 'gm''sb')");
  });

  it("resolves selected ids, including the not-set sentinel 0", async () => {
    const spy = stub();
    await fetchAutomatedSystemsFiltered({ ids: [0, 582] });
    expect(lastUrl(spy).searchParams.get("$filter")).toBe("id in (0,582)");
  });

  it("sends no $filter when nothing is filtered", async () => {
    const spy = stub();
    await fetchAutomatedSystemsFiltered({});
    expect(lastUrl(spy).searchParams.has("$filter")).toBe(false);
  });
});
