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

export function validateTeamSimpleFields(search: Record<string, unknown>) {
  return {
    name: asStr(search.name),
    code: asStr(search.code),
    type: asStrArray(search.type),
    leaderId: asNum(search.leaderId),
    leaderRole: asStr(search.leaderRole),
    structure: asStr(search.structure),
  };
}
