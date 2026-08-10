type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function normalizeAppBadgeCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}

export async function updateAppBadge(value: unknown): Promise<void> {
  const count = normalizeAppBadgeCount(value);
  if (count === null || typeof navigator === "undefined") return;

  const badgeNavigator = navigator as BadgeNavigator;
  try {
    if (count > 0) {
      if (typeof badgeNavigator.setAppBadge === "function") await badgeNavigator.setAppBadge(count);
      return;
    }
    if (typeof badgeNavigator.clearAppBadge === "function") await badgeNavigator.clearAppBadge();
  } catch {
    // Badging API failures must never affect notification or authentication flows.
  }
}

export function clearAppBadge(): Promise<void> {
  return updateAppBadge(0);
}
