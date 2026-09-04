function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNum(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}
function asStrArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string" && v.length > 0) return v.split(",");
  return undefined;
}

export function validateAutomatedSystemSimpleFields(
  search: Record<string, unknown>,
) {
  return {
    name: asStr(search.name),
    ci: asStr(search.ci),
    block: asStr(search.block),
    tribe: asStr(search.tribe),
    cluster: asStr(search.cluster),
    status: asStrArray(search.status),
    leaderComment: asStr(search.leaderComment),
    leaderId: asNum(search.leaderId),
  };
}
