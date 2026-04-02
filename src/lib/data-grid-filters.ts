import type {
  BooleanFilterOperator,
  DateFilterOperator,
  FilterOperator,
  NumberFilterOperator,
  SelectFilterOperator,
  TextFilterOperator,
} from "@/types/data-grid";

export const TEXT_FILTER_OPERATORS: ReadonlyArray<{
  label: string;
  value: TextFilterOperator;
}> = [
  { label: "Contains", value: "contains" },
  { label: "Does not contain", value: "notContains" },
  { label: "Is", value: "equals" },
  { label: "Is not", value: "notEquals" },
  { label: "Starts with", value: "startsWith" },
  { label: "Ends with", value: "endsWith" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
];

export const NUMBER_FILTER_OPERATORS: ReadonlyArray<{
  label: string;
  value: NumberFilterOperator;
}> = [
  { label: "Is", value: "equals" },
  { label: "Is not", value: "notEquals" },
  { label: "Is less than", value: "lessThan" },
  { label: "Is less than or equal to", value: "lessThanOrEqual" },
  { label: "Is greater than", value: "greaterThan" },
  { label: "Is greater than or equal to", value: "greaterThanOrEqual" },
  { label: "Is between", value: "isBetween" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
];

export const DATE_FILTER_OPERATORS: ReadonlyArray<{
  label: string;
  value: DateFilterOperator;
}> = [
  { label: "Is", value: "equals" },
  { label: "Is not", value: "notEquals" },
  { label: "Is before", value: "before" },
  { label: "Is after", value: "after" },
  { label: "Is on or before", value: "onOrBefore" },
  { label: "Is on or after", value: "onOrAfter" },
  { label: "Is between", value: "isBetween" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
];

export const SELECT_FILTER_OPERATORS: ReadonlyArray<{
  label: string;
  value: SelectFilterOperator;
}> = [
  { label: "Is", value: "is" },
  { label: "Is not", value: "isNot" },
  { label: "Has any of", value: "isAnyOf" },
  { label: "Has none of", value: "isNoneOf" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
];

export const BOOLEAN_FILTER_OPERATORS: ReadonlyArray<{
  label: string;
  value: BooleanFilterOperator;
}> = [
  { label: "Is true", value: "isTrue" },
  { label: "Is false", value: "isFalse" },
];

export function getDefaultOperator(variant: string): FilterOperator {
  switch (variant) {
    case "number":
      return "equals";
    case "date":
      return "equals";
    case "select":
    case "multi-select":
      return "is";
    case "checkbox":
      return "isTrue";
    default:
      return "contains";
  }
}

export function getOperatorsForVariant(
  variant: string,
): ReadonlyArray<{ label: string; value: FilterOperator }> {
  switch (variant) {
    case "number":
      return NUMBER_FILTER_OPERATORS;
    case "date":
      return DATE_FILTER_OPERATORS;
    case "select":
    case "multi-select":
      return SELECT_FILTER_OPERATORS;
    case "checkbox":
      return BOOLEAN_FILTER_OPERATORS;
    default:
      return TEXT_FILTER_OPERATORS;
  }
}
