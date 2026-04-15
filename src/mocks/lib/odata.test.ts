import { describe, it, expect } from "vitest";
import { __test } from "./odata";

const { applyFilter } = __test;

type Box = {
  id: number;
  name: string;
  objectCode: string | null;
  shape: string;
  num: number;
  checkbox: boolean;
  tags: string[];
  dateStr: string;
  item: { id: number; name: string } | null;
  things: { id: number; name: string }[];
};

const boxes: Box[] = [
  {
    id: 1, name: "alpha bet", objectCode: "CNT-001", shape: "O", num: 1,
    checkbox: true, tags: ["a", "x"], dateStr: "2026-01-15",
    item: { id: 10, name: "i10" }, things: [{ id: 1, name: "t1" }, { id: 2, name: "t2" }],
  },
  {
    id: 2, name: "beta", objectCode: "CNT-002", shape: "X", num: 5,
    checkbox: false, tags: ["b"], dateStr: "2026-02-10",
    item: null, things: [],
  },
  {
    id: 3, name: "gamma bet", objectCode: null, shape: "O", num: 8,
    checkbox: true, tags: [], dateStr: "2026-03-01",
    item: { id: 11, name: "i11" }, things: [{ id: 3, name: "t3" }],
  },
  {
    id: 4, name: "delta", objectCode: "CNT-003", shape: "T", num: 2,
    checkbox: false, tags: ["a", "y"], dateStr: "2026-01-05",
    item: { id: 12, name: "i12" }, things: [{ id: 1, name: "t1b" }],
  },
  {
    id: 5, name: "epsilon", objectCode: null, shape: "X", num: 10,
    checkbox: true, tags: ["x", "y"], dateStr: "2026-04-01",
    item: null, things: [{ id: 4, name: "t4" }, { id: 5, name: "t5" }],
  },
];

function ids(rows: Box[]) { return rows.map((r) => r.id).sort((a, b) => a - b); }

describe("odata parser — advanced", () => {
  it("ne string", () => {
    expect(ids(applyFilter(boxes, "shape ne 'X'"))).toEqual([1, 3, 4]);
  });
  it("ne on nullable string", () => {
    expect(ids(applyFilter(boxes, "objectCode ne 'CNT-002'"))).toEqual([1, 3, 4, 5]);
  });
  it("eq null", () => {
    expect(ids(applyFilter(boxes, "objectCode eq null"))).toEqual([3, 5]);
  });
  it("ne null", () => {
    expect(ids(applyFilter(boxes, "objectCode ne null"))).toEqual([1, 2, 4]);
  });
  it("numeric range parens", () => {
    expect(ids(applyFilter(boxes, "(num ge 2 and num le 8)"))).toEqual([2, 3, 4]);
  });
  it("date range parens", () => {
    expect(ids(applyFilter(boxes, "(dateStr ge '2026-01-01' and dateStr le '2026-02-01')"))).toEqual([1, 4]);
  });
  it("string in list", () => {
    expect(ids(applyFilter(boxes, "shape in ('O','X')"))).toEqual([1, 2, 3, 5]);
  });
  it("not (tags in list) — array membership", () => {
    // tags in ('a','b') matches boxes 1 (a), 2 (b), 4 (a). not → 3, 5
    expect(ids(applyFilter(boxes, "not (tags in ('a','b'))"))).toEqual([3, 5]);
  });
  it("things/any(x: x/id in (1,2))", () => {
    expect(ids(applyFilter(boxes, "things/any(x: x/id in (1,2))"))).toEqual([1, 4]);
  });
  it("not (things/any(x: x/id in (1)))", () => {
    expect(ids(applyFilter(boxes, "not (things/any(x: x/id in (1)))"))).toEqual([2, 3, 5]);
  });
  it("item eq null (nav null)", () => {
    expect(ids(applyFilter(boxes, "item eq null"))).toEqual([2, 5]);
  });
  it("item ne null", () => {
    expect(ids(applyFilter(boxes, "item ne null"))).toEqual([1, 3, 4]);
  });
  it("top-level or", () => {
    // 'bet' matches alpha bet(1), beta(2), gamma bet(3); shape O adds nothing new → [1,2,3]
    expect(ids(applyFilter(boxes, "contains_ignoring_case(name, 'bet') or shape eq 'O'"))).toEqual([1, 2, 3]);
  });
  it("mixed precedence", () => {
    // (num ge 1 and num le 5) → 1,2,4 ; not (tags in ('x')) → 2,3,4 ; OR → 1,2,3,4
    expect(ids(applyFilter(boxes, "(num ge 1 and num le 5) or not (tags in ('x'))"))).toEqual([1, 2, 3, 4]);
  });
});

describe("odata parser — legacy compat", () => {
  it("contains_ignoring_case", () => {
    expect(ids(applyFilter(boxes, "contains_ignoring_case(name, 'BET')"))).toEqual([1, 2, 3]);
  });
  it("name ge 'A'", () => {
    expect(applyFilter(boxes, "name ge 'a'").length).toBe(5);
  });
  it("num ge 5 and num le 10", () => {
    expect(ids(applyFilter(boxes, "num ge 5 and num le 10"))).toEqual([2, 3, 5]);
  });
  it("shape eq 'O'", () => {
    expect(ids(applyFilter(boxes, "shape eq 'O'"))).toEqual([1, 3]);
  });
  it("item/id eq 10", () => {
    expect(ids(applyFilter(boxes, "item/id eq 10"))).toEqual([1]);
  });
  it("things/any(x: x/id eq 3)", () => {
    expect(ids(applyFilter(boxes, "things/any(x: x/id eq 3)"))).toEqual([3]);
  });
});
