# Cometa Frontend

## Commands
- `npm run dev` — start dev server (http://localhost:5173)
- `npm run build` — production build
- `npx tsc --noEmit` — type-check

## Architecture
- **React + TypeScript + Vite** (Vite 8)
- **TanStack Router** — file-based routing (`src/routes/`), auto-generates `src/routeTree.gen.ts` (do not edit)
- **TanStack Query** — server state management
- **TanStack Table** — data tables
- **@xyflow/react** — flow graph visualization
- **shadcn/ui** — component library (Tailwind CSS v4, components in `src/components/ui/`)
- **Tailwind CSS v4** — styling via `@tailwindcss/vite` plugin

## Project Structure
```
src/
  components/ui/    # shadcn components (added via `npx shadcn@latest add <name>`)
  lib/utils.ts      # cn() utility
  routes/           # file-based routes (TanStack Router)
    __root.tsx      # root layout with sidebar navigation
    index.tsx       # redirects to /automated-system
    automated-system/
    flow-graph/
    components/
  main.tsx          # app bootstrap (QueryClient, Router)
  index.css         # Tailwind + shadcn CSS tokens
```

## Conventions
- Path alias: `@/` → `src/`
- API proxy: `/api` → `http://localhost:8080`
- Add shadcn components with: `npx shadcn@latest add <component>`
- `.npmrc` has `legacy-peer-deps=true` (Vite 8 peer dep compat)
