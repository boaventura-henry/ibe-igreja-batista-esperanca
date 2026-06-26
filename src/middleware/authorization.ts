import type { AuthRole } from "@/types";

export function canAccessRoute(role: AuthRole | undefined, pathname: string) {
  void pathname;

  return Boolean(role);
}
