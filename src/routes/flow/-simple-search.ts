function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asStrArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string" && v.length > 0) return v.split(",");
  return undefined;
}

export function validateFlowSimpleFields(search: Record<string, unknown>) {
  return {
    key: asStr(search.key),
    caption: asStr(search.caption),
    integrity: asStrArray(search.integrity),
    confidentiality: asStrArray(search.confidentiality),
    dataClass: asStrArray(search.dataClass),
    dataType: asStr(search.dataType),
  };
}
