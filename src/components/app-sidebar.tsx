import { forwardRef, useState } from "react";
import { createLink, useMatchRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
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
  SidebarRail,
} from "@/components/ui/sidebar";

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
  { to: "/automated-system", label: "Automated Systems" },
  { to: "/flow-graph", label: "Flow Graph" },
  { to: "/components", label: "Components" },
] as const;

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

  return (
    <Sidebar>
      <SidebarHeader className="p-4 font-semibold text-lg border-b border-sidebar-border">
        Cometa
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
                    <span>{item.label}</span>
                  </SidebarMenuButtonLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme}>
              {isDark ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
              <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
