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

/**
 * Column ids this page must never let reach `$orderby`.
 *
 * `guid` is a reserved literal token in odata-mini's `$orderby` ANTLR grammar
 * (case-insensitively — `guid`, `Guid` and `GUID` all hit it), so
 * `$orderby=guid asc` dies as a parse error *before* any field is resolved and
 * the backend answers 500. `odata.mini.repo.throw-on-field-not-found: false`
 * cannot rescue it: the request never gets as far as looking a field up. This
 * is the same root cause recorded on the column itself in
 * `src/features/automated-system/columns.tsx`; verified live 2026-09-05
 * against odata-mini 2.2.0.
 *
 * `enableSorting: false` on that column is only a UI affordance guard — it
 * removes Asc/Desc from the header dropdown (`DataTableColumnHeader` gates
 * them on `column.getCanSort()`) and nothing more. A bookmarked, shared or
 * hand-edited `?sort=guid.asc` bypasses the menu entirely: the URL is
 * validated only as "is it a string", flows through `parseSorting` into table
 * sorting state, and is emitted verbatim into `$orderby`. This set is the
 * query-layer guard that closes that path. Add an id here for the next
 * grammar collision — do not "restore" a sort by deleting an entry.
 */
export const AUTOMATED_SYSTEM_UNSORTABLE_COLUMN_IDS: ReadonlySet<string> =
  new Set(["guid"]);

/**
 * Removes any `<id>.<dir>` part of a `sort` search param that targets an
 * unsortable column, keeping every other part untouched.
 *
 * Per-part rather than all-or-nothing: in a multi-column sort such as
 * `fullName.asc,guid.desc` the surviving parts still express a legitimate
 * ordering, and honouring them is closer to what the URL asked for than
 * discarding the lot. When nothing survives, the result is `undefined` — the
 * value an absent `sort` param already has, so the table falls back to its
 * default ordering rather than sorting on a column that 500s.
 *
 * Matching is case-insensitive because the grammar collision is: `GUID.asc`
 * would otherwise pass through here and reach `$orderby` verbatim (the query
 * builder falls back to the bare id for an unknown column) and 500 just the
 * same.
 */
export function dropUnsortableSort(
  sort: string | undefined,
): string | undefined {
  if (sort === undefined) return undefined;
  const kept = sort
    .split(",")
    .filter(
      (part) =>
        !AUTOMATED_SYSTEM_UNSORTABLE_COLUMN_IDS.has(
          part.split(".")[0]!.toLowerCase(),
        ),
    );
  return kept.length > 0 ? kept.join(",") : undefined;
}

/**
 * What this route hands to `makeSwitchableSearch`: the simple filter fields
 * plus the unsortable-column guard on `sort`.
 *
 * The guard rides in on the simple-fields channel rather than wrapping the
 * validator `makeSwitchableSearch` returns, because `makeSwitchableSearch`
 * spreads the resource's simple fields *after* its own base fields — so the
 * `sort` returned here overrides the base's unchecked pass-through. Wrapping
 * that returned validator in another function, or even just binding it to a
 * `const`, changes what TanStack infers as this route's required search params
 * and breaks every `to: "/automated-system"` navigation in the app; the
 * generic call has to stay inline at the route.
 */
export function validateAutomatedSystemSearchFields(
  search: Record<string, unknown>,
) {
  return {
    ...validateAutomatedSystemSimpleFields(search),
    sort: dropUnsortableSort(asStr(search.sort)),
  };
}
