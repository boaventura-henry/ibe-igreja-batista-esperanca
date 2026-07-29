import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const environment = process.env.VERCEL_ENV ?? "local";

if (environment !== "production") {
  console.log(
    `[production-migrations] Skipped because VERCEL_ENV is "${environment}".`,
  );
  process.exit(0);
}

console.log(
  "[production-migrations] Production environment confirmed. Running Prisma migrate deploy.",
);

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(
    `[production-migrations] Unable to start Prisma migrate deploy: ${result.error.message}`,
  );
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `[production-migrations] Prisma migrate deploy failed with exit code ${result.status ?? "unknown"}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("[production-migrations] Prisma migrate deploy completed successfully.");
