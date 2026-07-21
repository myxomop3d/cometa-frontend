import {
  createRootRouteWithContext,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayoutWithAuth,
  beforeLoad: ({ location }) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("cometa-auth-token")
        : null;
    if (
      !token &&
      location.pathname !== "/login" &&
      location.pathname !== "/register" &&
      location.pathname !== "/forbidden"
    ) {
      throw redirect({ to: "/login" });
    }
  },
});

function RootLayoutWithAuth() {
  return (
    <AuthProvider>
      <RootLayout />
    </AuthProvider>
  );
}

function RootLayout() {
  const { isLoading } = useAuth();
  const router = useRouter();

  // Show a simple loader while checking auth on initial load
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const isAuthPage =
    router.state.location.pathname === "/login" ||
    router.state.location.pathname === "/register" ||
    router.state.location.pathname === "/forbidden";

  return (
    <SidebarProvider>
      {!isAuthPage && <AppSidebar />}
      <main className={`flex-1 overflow-auto ${!isAuthPage ? "p-6" : ""}`}>
        <Outlet />
      </main>
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools buttonPosition="bottom-left" />
      <Toaster />
    </SidebarProvider>
  );
}
