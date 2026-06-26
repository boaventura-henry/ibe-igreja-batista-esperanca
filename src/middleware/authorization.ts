import type { AuthRole } from "@/types";

export function canAccessRoute(role: AuthRole | undefined, pathname: string) {
  void role;
  void pathname;

  // Route authorization rules will live here when protected pages are introduced.
  return true;
}
