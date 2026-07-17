import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

const router = createRouter({ routeTree, context: { queryClient } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Intercept fetch() calls to attach the Authorization header (API only) and handle auth errors.
const __origFetch = window.fetch.bind(window);

// Only same-origin /api requests get the token — never leak it to third-party/absolute URLs.
function isApiRequest(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/api");
  } catch {
    return false;
  }
}

window.fetch = async (input, init) => {
  if (isApiRequest(input)) {
    const token = localStorage.getItem("cometa-auth-token");
    if (token) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      init = { ...init, headers };
    }
  }
  const res = await __origFetch(input, init);
  const path = window.location.pathname;
  // Expired/invalid token on an API call → clear session and re-login.
  // Skip when already on /login so login-form 401s (bad credentials) surface as errors.
  if (res.status === 401 && isApiRequest(input) && !path.startsWith("/login")) {
    localStorage.removeItem("cometa-auth-token");
    window.location.href = "/login";
  }
  if (res.status === 403 && !path.startsWith("/forbidden")) {
    window.location.href = "/forbidden";
  }
  return res;
};

async function bootstrap() {
  if (import.meta.env.VITE_MOCK_API === "true") {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      onUnhandledRequest: "bypass",
    });
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

bootstrap();
