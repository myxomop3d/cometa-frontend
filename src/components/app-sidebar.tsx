import { forwardRef, useState } from "react";
import { createLink, useMatchRoute } from "@tanstack/react-router";
import {
  Cpu,
  LogOut,
  Moon,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  User,
  Users,
  Workflow,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";

// Create a type-safe router link from SidebarMenuButton
const SidebarMenuButtonLink = createLink(
  forwardRef<
    HTMLAnchorElement,
    React.ComponentProps<"a"> &
      Pick<
        React.ComponentProps<typeof SidebarMenuButton>,
        "isActive" | "tooltip" | "variant" | "size"
      >
  >(({ isActive, tooltip, variant, size, className, children, ...rest }, ref) => (
    <SidebarMenuButton
      isActive={isActive}
      tooltip={tooltip}
      variant={variant}
      size={size}
      className={className}
      render={<a ref={ref} {...rest} />}
    >
      {children}
    </SidebarMenuButton>
  ))
);

const navItems = [
  { to: "/automated-system", label: "Automated Systems", icon: Cpu },
  { to: "/flow-graph", label: "Flow Graph", icon: Network },
  { to: "/flow", label: "Flows", icon: Workflow },
  { to: "/person", label: "Persons", icon: User },
  { to: "/team", label: "Teams", icon: Users },
] as const;

/**
 * Pin/unpin the sidebar. Unlike the stock SidebarTrigger the icon reflects
 * `open` — the pinned state — not the transient hover peek.
 */
function SidebarToggle() {
  const { open, toggleSidebar } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      onClick={toggleSidebar}
      aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
      title={open ? "Collapse sidebar" : "Expand sidebar"}
    >
      {open ? <PanelLeftClose /> : <PanelLeftOpen />}
    </Button>
  );
}

export function AppSidebar() {
  const matchRoute = useMatchRoute();

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

  const { user, logout } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-2 border-b border-sidebar-border p-2">
        <SidebarToggle />
        <span className="truncate text-lg font-semibold group-data-[collapsible=icon]:hidden">
          Cometa
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButtonLink
                    to={item.to}
                    isActive={!!matchRoute({ to: item.to, fuzzy: true })}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButtonLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {user && (
          <div
            className="truncate px-3 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
            title={user.sigmaLogin}
          >
            {user.sigmaLogin}
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={isDark ? "Light Mode" : "Dark Mode"}
            >
              {isDark ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
              <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user && (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout} tooltip="Sign out">
                <LogOut className="size-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
