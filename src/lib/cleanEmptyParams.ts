const PAGE_DEFAULTS: Record<string, unknown> = { page: 1, pageSize: 20 };

export function cleanEmptyParams<T extends Record<string, unknown>>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([key, value]) => {
      if (!value && value !== 0 && value !== false) return false;
      if (key in PAGE_DEFAULTS && value === PAGE_DEFAULTS[key]) return false;
      return true;
    }),
  ) as Partial<T>;
}
