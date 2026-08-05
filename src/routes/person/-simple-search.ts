function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function validatePersonSimpleFields(search: Record<string, unknown>) {
  return {
    email: asStr(search.email),
    lastName: asStr(search.lastName),
    firstName: asStr(search.firstName),
    middleName: asStr(search.middleName),
  };
}
