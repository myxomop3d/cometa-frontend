import { describe, it, expect } from "vitest";
import { makeSwitchableSearch } from "@/lib/data-table/switchable-search";
import {
  AUTOMATED_SYSTEM_UNSORTABLE_COLUMN_IDS,
  dropUnsortableSort,
  validateAutomatedSystemSearchFields,
} from "./-simple-search";

// `dropUnsortableSort` is the query-layer guard for the `guid` column. The
// column's `enableSorting: false` only removes Asc/Desc from the header
// dropdown; a bookmarked or hand-edited `?sort=guid.asc` still reaches
// `$orderby`, where odata-mini's ANTLR grammar treats `guid` as a reserved
// literal token and the request 500s. These cases are the evidence that path
// is closed.
describe("dropUnsortableSort", () => {
  it("names its unsortable columns in one place", () => {
    expect([...AUTOMATED_SYSTEM_UNSORTABLE_COLUMN_IDS]).toEqual(["guid"]);
  });

  it("drops a guid ascending sort", () => {
    expect(dropUnsortableSort("guid.asc")).toBeUndefined();
  });

  it("drops a guid descending sort", () => {
    expect(dropUnsortableSort("guid.desc")).toBeUndefined();
  });

  it("drops a bare guid with no direction", () => {
    expect(dropUnsortableSort("guid")).toBeUndefined();
  });

  it("drops guid case-insensitively, as the grammar collision is", () => {
    expect(dropUnsortableSort("GUID.asc")).toBeUndefined();
    expect(dropUnsortableSort("Guid.desc")).toBeUndefined();
  });

  it("leaves a relation sort untouched", () => {
    expect(dropUnsortableSort("leader.asc")).toBe("leader.asc");
    expect(dropUnsortableSort("leader.desc")).toBe("leader.desc");
  });

  it("leaves a plain scalar sort untouched", () => {
    expect(dropUnsortableSort("fullName.asc")).toBe("fullName.asc");
  });

  it("leaves a column whose id merely contains 'guid' untouched", () => {
    // `guidX`/`myguid` get past the parser and fail later at attribute
    // resolution instead, so they are not this guard's business.
    expect(dropUnsortableSort("myguid.asc")).toBe("myguid.asc");
  });

  it("passes an absent sort through", () => {
    expect(dropUnsortableSort(undefined)).toBeUndefined();
  });

  it("keeps the sortable parts of a multi-column sort and drops only guid", () => {
    expect(dropUnsortableSort("fullName.asc,guid.desc")).toBe("fullName.asc");
    expect(dropUnsortableSort("guid.asc,fullName.desc")).toBe("fullName.desc");
    expect(dropUnsortableSort("leader.asc,guid.desc,fullName.asc")).toBe(
      "leader.asc,fullName.asc",
    );
  });

  it("returns undefined when every part is unsortable", () => {
    expect(dropUnsortableSort("guid.asc,GUID.desc")).toBeUndefined();
  });

  it("leaves a multi-column sort with no unsortable part untouched", () => {
    expect(dropUnsortableSort("leader.asc,fullName.desc")).toBe(
      "leader.asc,fullName.desc",
    );
  });
});

// The route composes the guard by handing `validateAutomatedSystemSearchFields`
// to `makeSwitchableSearch`, which relies on the resource's simple fields being
// spread *after* the base ones. These cases exercise that whole path — the same
// expression the route file uses — so the override cannot silently stop working.
describe("validateAutomatedSystemSearchFields through makeSwitchableSearch", () => {
  const validateSearch = makeSwitchableSearch(
    validateAutomatedSystemSearchFields,
  );

  it("drops ?sort=guid.asc before it can reach $orderby", () => {
    expect(validateSearch({ sort: "guid.asc" }).sort).toBeUndefined();
  });

  it("drops ?sort=guid.desc before it can reach $orderby", () => {
    expect(validateSearch({ sort: "guid.desc" }).sort).toBeUndefined();
  });

  it("keeps a legitimate relation sort", () => {
    expect(validateSearch({ sort: "leader.asc" }).sort).toBe("leader.asc");
  });

  it("keeps a legitimate scalar sort", () => {
    expect(validateSearch({ sort: "fullName.asc" }).sort).toBe("fullName.asc");
  });

  it("keeps the sortable half of a mixed multi-column sort", () => {
    expect(validateSearch({ sort: "fullName.asc,guid.desc" }).sort).toBe(
      "fullName.asc",
    );
  });

  it("leaves an absent sort absent", () => {
    expect(validateSearch({}).sort).toBeUndefined();
  });

  it("ignores a non-string sort, as the base validator does", () => {
    expect(validateSearch({ sort: 42 }).sort).toBeUndefined();
  });

  it("still validates the simple filter fields", () => {
    const s = validateSearch({
      sort: "guid.asc",
      name: "PRIME",
      leaderId: "33",
      status: "a,b",
    });
    expect(s.sort).toBeUndefined();
    expect(s.name).toBe("PRIME");
    expect(s.leaderId).toBe(33);
    expect(s.status).toEqual(["a", "b"]);
    expect(s.page).toBe(1);
  });
});
