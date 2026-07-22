type SmokeResult = {
  name: string;
  url: string;
  status: number | null;
  ok: boolean;
  expected: string;
  detail?: string;
};

const baseUrl = (process.env.SMOKE_BASE_URL ?? "https://ibe-igreja-batista-esperanca.vercel.app").replace(/\/$/, "");
const cookie = process.env.SMOKE_COOKIE?.trim();

function headers() {
  return cookie ? { cookie } : undefined;
}

async function check(name: string, path: string, allowedStatuses: number[], expected: string): Promise<SmokeResult> {
  const url = `${baseUrl}${path}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: headers(),
      cache: "no-store"
    });
    return {
      name,
      url,
      status: response.status,
      ok: allowedStatuses.includes(response.status),
      expected,
      detail: response.headers.get("location") ? `location=${response.headers.get("location")}` : undefined
    };
  } catch (error) {
    return {
      name,
      url,
      status: null,
      ok: false,
      expected,
      detail: error instanceof Error ? error.message : "unknown error"
    };
  }
}

async function main() {
  const protectedPageStatuses = cookie ? [200] : [302, 307, 308];
  const protectedApiStatuses = cookie ? [200, 403] : [401, 403];

  const checks = await Promise.all([
    check("home", "/", [200, 302, 307, 308], "public page or redirect"),
    check("login", "/login", [200], "login page available"),
    check("dashboard page", "/dashboard", protectedPageStatuses, cookie ? "authenticated dashboard" : "redirects anonymous user"),
    check("portal page", "/portal", protectedPageStatuses, cookie ? "authenticated portal" : "redirects anonymous user"),
    check("database health", "/api/health/db", [200], "database health endpoint"),
    check("admin dashboard api", "/api/dashboard/admin", protectedApiStatuses, cookie ? "authorized or forbidden by RBAC" : "protected API"),
    check("portal dashboard api", "/api/dashboard/portal", protectedApiStatuses, cookie ? "authorized or forbidden by RBAC" : "protected API")
  ]);

  let failed = 0;
  for (const result of checks) {
    const marker = result.ok ? "OK" : "FAIL";
    const status = result.status ?? "ERR";
    const detail = result.detail ? ` (${result.detail})` : "";
    console.log(`${marker} ${result.name}: ${status} - ${result.expected}${detail}`);
    if (!result.ok) failed += 1;
  }

  if (failed > 0) {
    console.error(`Smoke test failed: ${failed}/${checks.length}`);
    process.exit(1);
  }

  console.log(`Smoke test passed: ${checks.length}/${checks.length}`);
}

void main();
