import { useState } from "react";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";

export interface RouterContext {
  queryClient: QueryClient;
}

const navItems = [
  { to: "/automated-system", label: "Automated Systems" },
  { to: "/flow-graph", label: "Flow Graph" },
  { to: "/components", label: "Components" },
] as const;

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    const dark = stored === "dark";
    if (dark) document.documentElement.classList.add("dark");
    return dark;
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="p-4 font-semibold text-lg border-b border-border">
          Cometa
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors [&.active]:bg-sidebar-primary [&.active]:text-sidebar-primary-foreground [&.active]:font-medium"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-2 border-t border-border">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </div>
  );
}
