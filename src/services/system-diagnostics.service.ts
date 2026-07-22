import { EXPECTED_DATABASE_SCHEMA } from "@/config/database-schema";
import { getAppVersionInfo } from "@/lib/app-version";
import { MigrationsTableUnavailableError, systemDiagnosticsRepository } from "@/repositories/system-diagnostics.repository";

export type SchemaAlignmentStatus = "UP_TO_DATE" | "OUTDATED" | "UNKNOWN" | "ERROR" | "AHEAD";

export function resolveSchemaAlignment(lastMigration: string | null, expectedMigration = EXPECTED_DATABASE_SCHEMA.latestMigration): SchemaAlignmentStatus {
  if (!lastMigration) return "UNKNOWN";
  if (lastMigration === expectedMigration) return "UP_TO_DATE";
  return lastMigration > expectedMigration ? "AHEAD" : "OUTDATED";
}

export function buildUnavailableDatabaseDiagnostics(tableMissing: boolean) {
  return {
    connection: tableMissing ? "CONNECTED" as const : "UNAVAILABLE" as const,
    expectedMigration: EXPECTED_DATABASE_SCHEMA.latestMigration,
    completedCount: null,
    lastMigration: null,
    lastAppliedAt: null,
    hasFailedMigration: false,
    status: tableMissing ? "UNKNOWN" as const : "ERROR" as const
  };
}

export const systemDiagnosticsService = {
  async getDiagnostics() {
    const application = getAppVersionInfo();
    try {
      const migrations = await systemDiagnosticsRepository.getMigrationSummary();
      return {
        application,
        database: {
          connection: "CONNECTED" as const,
          expectedMigration: EXPECTED_DATABASE_SCHEMA.latestMigration,
          ...migrations,
          lastAppliedAt: migrations.lastAppliedAt?.toISOString() ?? null,
          status: resolveSchemaAlignment(migrations.lastMigration)
        }
      };
    } catch (error) {
      const tableMissing = error instanceof MigrationsTableUnavailableError;
      return {
        application,
        database: buildUnavailableDatabaseDiagnostics(tableMissing)
      };
    }
  }
};
