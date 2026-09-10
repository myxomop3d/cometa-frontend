# Cometa Frontend

Frontend application for the Cometa platform — visualizes message dataflow through applications, brokers, and infrastructure components.

## Tech Stack

- **React 19** + **TypeScript 5.9** + **Vite 8**
- **TanStack Router** — file-based routing (`src/routes/`)
- **TanStack Query** — server state management with OData-style API
- **TanStack Table** — data tables with server-side filtering, sorting, pagination
- **shadcn/ui** on **Tailwind CSS v4** — component library
- **React Hook Form** + **Zod** — form handling and validation
- **@xyflow/react** — flow graph visualization
- **MSW 2** — optional mock API layer for local development

## Getting Started

```bash
npm install
npm run dev              # start dev server at http://localhost:5173
```

## Scripts

| Command             | Description                            |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Start Vite dev server                  |
| `npm run build`     | Type-check (`tsc -b`) + production build |
| `npm run lint`      | ESLint                                 |
| `npm run test`      | Run Vitest tests                       |
| `npm run preview`   | Preview production build               |
| `npx tsc --noEmit`  | Type-check only                        |

## Project Structure

```
src/
  routes/                  # TanStack Router file-based routes
    __root.tsx             #   layout: sidebar + devtools
    automated-system/      #   data table with simple + advanced filtering
    flow/                  #   data table
    flow-graph/            #   @xyflow/react visualization
    person/, team/         #   data tables
    login, register, ...   #   auth screens
  features/
    <domain>/              # per-domain api, columns, sheet, schema, mappers
  components/
    ui/                    # shadcn primitives
    data-table/            # reusable table components (toolbar, pagination, filters)
  hooks/                   # useDataTable, useMobile
  config/                  # filter operators, variants
  lib/                     # utilities (cn, OData builders, sorting helpers)
  types/                   # ApiResponse envelope, DTOs, filter types
```

## Developer Guides

- [Advanced Table Manual](advanced-table-manual.md) — step-by-step guide for creating a new page with server-side filtered data table

## Conventions

- Path alias: `@/` maps to `src/`
- API proxy: `/api` proxied to `http://localhost:8080` (Vite config)
- **HTTPS backend (dev-cluster):** add `secure: false` in `vite.config.ts` `server.proxy` to avoid **502 Bad Gateway** — Vite's `http-proxy` cannot verify self-signed cluster certificates
- `src/routeTree.gen.ts` is auto-generated — never edit manually
- Add shadcn components: `npx shadcn@latest add <component>`
- `.npmrc` has `legacy-peer-deps=true`
