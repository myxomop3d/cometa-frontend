# Cometa Frontend

## Commands
- `npm run dev` — start dev server (http://localhost:5173)
- `npm run build` — production build (runs `tsc -b` then `vite build`, so it type-checks)
- `npm run lint` — ESLint
- `npm run preview` — preview production build
- `npx tsc --noEmit` — type-check only

## Tech Stack
- **React 19 + TypeScript 5.9 + Vite 8**
- **TanStack Router 1.167** — file-based routing under `src/routes/`, auto-generates `src/routeTree.gen.ts` (do not edit). Uses `@tanstack/router-plugin` with `autoCodeSplitting`.
- **TanStack Query 5** — server state; `QueryClient` injected via Router context. Defaults: `staleTime` 1 min, 1 retry.
- **TanStack Table 8** — data tables
- **shadcn/ui** on **Tailwind CSS v4** (`@tailwindcss/vite`), plus `@base-ui/react`, `cmdk`, `lucide-react`, `sonner`
- **Forms**: `react-hook-form` + `zod` + `@hookform/resolvers`
- **@xyflow/react** — flow graph visualization
- **Utils**: `date-fns`, `clsx` + `tailwind-merge` (via `cn()`)

## Project Structure
```
src/
  routes/                # TanStack Router file-based routes
    __root.tsx           # SidebarProvider + AppSidebar + devtools
    index.tsx            # redirect → /automated-system
    automated-system/    # switchable DataTable + sheet
    flow/, person/, team/  # switchable DataTable pages
    flow-graph/          # @xyflow/react visualization
    login.tsx, register.tsx, forbidden.tsx, auth.cert.callback.tsx
  features/              # per-domain logic, one dir per resource:
                         # automated-system, flow, flow-graph, person,
                         # register, team — each with api.ts,
                         # advanced-api.ts, columns.tsx, schema.ts,
                         # mappers.ts, filter-descriptors.ts,
                         # switchable-config.ts, components/
  api/
    auth.ts              # login, getMe, cert login, register
  components/
    ui/                  # shadcn primitives
    data-table/          # data-table, toolbar, advanced-toolbar, pagination,
                         # column-header, view-options, faceted-filter,
                         # date-filter, slider-filter, filter-list, skeleton
    app-sidebar.tsx, relation-picker.tsx, DebouncedInput.tsx
  hooks/
    use-data-table.ts    # central table state (sorting, pagination, filters, visibility, pinning)
    use-switchable-table-page.ts  # simple/advanced switchable page wiring
    use-mobile.ts
  config/
    data-table.ts        # filter operators (iLike, eq, ne, …) and filterVariants
                         # (text, number, range, date, boolean, select,
                         #  multiSelect, relation, multiRelation)
  lib/
    utils.ts             # cn()
    data-table.ts        # calculatePageSize, parseSorting, serializeSorting
    data-table/          # switchable-search, switchable-page
    odata/               # build-filter-params, build-advanced-filter-params
    api/                 # create-crud-api, apiFetch
    auth/                # auth-context, mtls-origin, cert-callback
    cleanEmptyParams.ts, format.ts, sidebar-cookie.ts
  types/
    api.ts               # ApiResponse<T> envelope + DTOs
    data-table.ts
  main.tsx               # QueryClient + Router bootstrap
  index.css              # Tailwind v4 + shadcn tokens
```

## Conventions
- Path alias: `@/` → `src/`
- API proxy: `/api` → `http://localhost:8080` (configured in `vite.config`)
- `src/routeTree.gen.ts` is auto-generated — never edit
- Add shadcn components with: `npx shadcn@latest add <component>`
- `.npmrc` has `legacy-peer-deps=true` (Vite 8 peer dep compat)
- **New tables**: define columns, drive state via `useDataTable`, compose with `components/data-table/*`; pick filter variants from `config/data-table.ts` the way the Team/Person pages do.
- **New API resources**: add `src/features/<domain>/api.ts` (plus `advanced-api.ts` where the page has an advanced filter) exporting `queryOptions(...)` factories; reuse the OData builders in `lib/odata/`. `src/api/` holds only cross-cutting auth calls.
- **Relation filters/sorts** (OData): a **to-one** relation uses a navigation
  path with `/` — `sortField: "leader/lastName"`, `contains_ignoring_case(leader/lastName, 'x')`.
  A dot is a parse error. A **to-many** relation uses `field/any(x: x/id in (…))`,
  is filterable only (never sortable), and must be the **last** clause in a
  `$filter` with at most one per request — odata-mini corrupts the root alias
  for every clause after an `any()`. Requires
  `odata.mini.repo.throw-on-field-not-found: false` on the backend. Full record:
  `docs/superpowers/specs/2026-08-26-odata-relation-filter-sort-design.md`.
- **Relation writes**: DTOs come in Flat/Full pairs — Flat carries every scalar
  of its entity and none of its relations; Full extends Flat and adds
  relations, each typed as the *child's Flat* DTO. Relations are written as
  refs (`{ id }`) where only `id` is honoured; other fields on the ref are
  silently dropped. PATCH semantics: field absent or `null` leaves membership
  unchanged, `[]` clears it, a non-empty array is a full replace. A mapper
  must never `uses` a service — it closes a constructor-injection bean cycle
  that Spring Boot 4 rejects at startup; ref resolution stays in the mapper
  layer against `EntityManager` only. Full record:
  `docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md`.
- **Scalar writes (no-null standard)**: the frontend never sends `null`. A key
  absent means "leave unchanged"; a value — including `""` — sets the field.
  Every type carries its own empty value: `""` for text, an explicit enum
  member, a sentinel row for a to-one, `[]` for a to-many. 33 columns are
  `NOT NULL DEFAULT ''` (`db-scripts/ddl/014`, `015`), so this is a schema
  invariant, not a convention. Use `emptyText()` in a form schema, never a
  `"" → null` transform, and `dash()` from `@/lib/format` to render a cell.
  Known exception: `team.type` is `@Enumerated` over a nullable column and is
  settable but not clearable. Full record:
  `docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md`.
- TS config: strict, `noUnusedLocals`/`noUnusedParameters`, ES2023 target, bundler resolution, `jsx: react-jsx`
