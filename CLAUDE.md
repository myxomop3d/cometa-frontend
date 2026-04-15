# Cometa Frontend

## Commands
- `npm run dev` — start dev server (http://localhost:5173)
- `VITE_MOCK_API=true npm run dev` — dev server with MSW-mocked API
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
- **MSW 2** — optional mock API (`src/mocks/`), enabled via `VITE_MOCK_API=true`

## Project Structure
```
src/
  routes/                # TanStack Router file-based routes
    __root.tsx           # SidebarProvider + AppSidebar + devtools
    index.tsx            # redirect → /automated-system
    automated-system/    # RHF + zod form example
    box/
    box-dice/            # -box-table-columns.tsx, -box-sheet.tsx
    flow-graph/
    components/          # component showcase
  api/                   # TanStack Query queryOptions per resource
                         # automated-system.ts, box.ts, item.ts, thing.ts
                         # OData-style filter helpers (contains_ignoring_case, tags/any())
  components/
    ui/                  # shadcn primitives
    data-table/          # data-table, toolbar, pagination, column-header,
                         # view-options, faceted-filter, date-filter,
                         # slider-filter, skeleton
    filters/             # CheckboxFilter, DateRangeFilter, NumberRangeFilter,
                         # SelectFilter, TextFilter, RelationFilterDropdown,
                         # RelationFilterModal
    app-sidebar.tsx, relation-picker.tsx, DebouncedInput.tsx, SimpleTable.tsx
  hooks/
    use-data-table.ts    # central table state (sorting, pagination, filters, visibility, pinning)
    useFilters.ts, use-mobile.ts
  config/
    data-table.ts        # filter operators (iLike, eq, ne, …) and filterVariants
                         # (text, number, range, date, boolean, select,
                         #  multiSelect, relation, multiRelation)
  lib/
    utils.ts             # cn()
    data-table.ts        # calculatePageSize, parseSorting, serializeSorting
    cleanEmptyParams.ts, format.ts
  types/
    api.ts               # ApiResponse<T> envelope + DTOs (BoxDto, ItemDto, ThingDto, …)
    data-table.ts, table.ts
  mocks/                 # MSW handlers + fixtures
  main.tsx               # QueryClient + Router bootstrap
  index.css              # Tailwind v4 + shadcn tokens
```

## Conventions
- Path alias: `@/` → `src/`
- API proxy: `/api` → `http://localhost:8080` (configured in `vite.config`)
- `src/routeTree.gen.ts` is auto-generated — never edit
- Add shadcn components with: `npx shadcn@latest add <component>`
- `.npmrc` has `legacy-peer-deps=true` (Vite 8 peer dep compat)
- **New tables**: define columns, drive state via `useDataTable`, compose with `components/data-table/*`; pick filters from `components/filters/*` and operator/variant config from `config/data-table.ts`.
- **New API resources**: add a file under `src/api/` exporting `queryOptions(...)` factories; reuse the OData filter helpers.
- TS config: strict, `noUnusedLocals`/`noUnusedParameters`, ES2023 target, bundler resolution, `jsx: react-jsx`
