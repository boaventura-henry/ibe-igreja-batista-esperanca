import assert from "node:assert/strict";
import { clearAppBadge, normalizeAppBadgeCount, updateAppBadge } from "@/lib/app-badge";

type BadgeCall = { kind: "set" | "clear"; count?: number };

function installNavigator(overrides: Record<string, unknown>) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: overrides });
}

async function main() {
  assert.equal(normalizeAppBadgeCount(153), 153);
  assert.equal(normalizeAppBadgeCount(0), 0);
  assert.equal(normalizeAppBadgeCount(-1), null);
  assert.equal(normalizeAppBadgeCount(Number.NaN), null);
  assert.equal(normalizeAppBadgeCount(Number.POSITIVE_INFINITY), null);
  assert.equal(normalizeAppBadgeCount(undefined), null);

  const calls: BadgeCall[] = [];
  installNavigator({
    setAppBadge: async (count?: number) => calls.push({ kind: "set", count }),
    clearAppBadge: async () => calls.push({ kind: "clear" })
  });
  await updateAppBadge(153);
  await updateAppBadge(0);
  await clearAppBadge();
  await updateAppBadge(-1);
  assert.deepEqual(calls, [
    { kind: "set", count: 153 },
    { kind: "clear" },
    { kind: "clear" }
  ]);

  installNavigator({});
  await updateAppBadge(5);
  await updateAppBadge(0);

  installNavigator({
    setAppBadge: async () => { throw new Error("unsupported"); },
    clearAppBadge: async () => { throw new Error("unsupported"); }
  });
  await updateAppBadge(1);
  await updateAppBadge(0);

  console.log("App badge tests passed.");
}

void main();
