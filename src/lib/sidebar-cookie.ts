export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Reads the persisted collapsed/expanded state. Pass the result as
 * `defaultOpen` on SidebarProvider so a reload keeps the last choice.
 */
export function getSidebarStateCookie() {
  if (typeof document === "undefined") return true;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SIDEBAR_COOKIE_NAME}=([^;]*)`)
  );
  return match ? match[1] !== "false" : true;
}
