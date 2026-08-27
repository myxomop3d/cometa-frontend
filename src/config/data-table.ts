import type { FilterOperator, FilterVariant } from "@/types/data-table";

export type DataTableConfig = typeof dataTableConfig;

export const dataTableConfig = {
  textOperators: [
    { label: "Contains", value: "iLike" as const },
    { label: "Does not contain", value: "notILike" as const },
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  numericOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is less than", value: "lt" as const },
    { label: "Is less than or equal to", value: "lte" as const },
    { label: "Is greater than", value: "gt" as const },
    { label: "Is greater than or equal to", value: "gte" as const },
    { label: "Is between", value: "isBetween" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  dateOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is before", value: "lt" as const },
    { label: "Is after", value: "gt" as const },
    { label: "Is on or before", value: "lte" as const },
    { label: "Is on or after", value: "gte" as const },
    { label: "Is between", value: "isBetween" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  selectOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  multiSelectOperators: [
    { label: "Has any of", value: "inArray" as const },
    { label: "Has none of", value: "notInArray" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  booleanOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
  ],
  relationOperators: [
    { label: "Has any of", value: "inArray" as const },
    { label: "Has none of", value: "notInArray" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  sortOrders: [
    { label: "Asc", value: "asc" as const },
    { label: "Desc", value: "desc" as const },
  ],
  filterVariants: [
    "text", "number", "range", "date", "dateRange",
    "boolean", "select", "multiSelect", "relation", "multiRelation",
  ] as const,
  operators: [
    "iLike", "notILike", "eq", "ne", "inArray", "notInArray",
    "isEmpty", "isNotEmpty", "lt", "lte", "gt", "gte", "isBetween",
  ] as const,
  joinOperators: ["and", "or"] as const,
};

export const operatorsByVariant: Record<FilterVariant, FilterOperator[]> = {
  text:          ["iLike", "eq", "ne", "isEmpty", "isNotEmpty"],
  number:        ["eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  range:         ["isBetween", "eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  date:          ["eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  dateRange:     ["isBetween", "eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  boolean:       ["eq"],
  select:        ["eq", "ne", "isEmpty", "isNotEmpty"],
  multiSelect:   ["inArray", "notInArray", "isEmpty", "isNotEmpty"],
  relation:      ["eq", "ne", "isEmpty", "isNotEmpty"],
  // No isEmpty/isNotEmpty here: `multiRelation` is a JPA collection, and
  // comparing a collection to null (`teams eq null`) raises a JPQL
  // SemanticException -> HTTP 500. Unlike `relation` (a to-one nav path,
  // e.g. `leader/id` — still single-valued, so `leader/id eq null` is the
  // legitimate spelling and was live-verified to return cleanly), there is
  // no verified any()-based spelling for "collection is empty" against this
  // backend, so the operator is withheld rather than guessed at.
  multiRelation: ["inArray", "notInArray"],
};

export const operatorLabels: Record<FilterOperator, string> = {
  iLike: "contains",
  notILike: "does not contain",
  eq: "is",
  ne: "is not",
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  isBetween: "is between",
  inArray: "is any of",
  notInArray: "is none of",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};
