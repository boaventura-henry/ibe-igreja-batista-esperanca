import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";

type MigrationSummaryRow = {
  completed_count: bigint;
  last_migration: string | null;
  last_applied_at: Date | null;
  failed_count: bigint;
};

export class MigrationsTableUnavailableError extends Error {}

export const systemDiagnosticsRepository = {
  async getMigrationSummary() {
    try {
      const rows = await prisma.$queryRaw<MigrationSummaryRow[]>`
        SELECT
          COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS completed_count,
          (ARRAY_AGG(migration_name ORDER BY finished_at DESC) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL))[1] AS last_migration,
          MAX(finished_at) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS last_applied_at,
          COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS failed_count
        FROM "_prisma_migrations"
      `;
      const row = rows[0];
      return {
        completedCount: Number(row?.completed_count ?? 0),
        lastMigration: row?.last_migration ?? null,
        lastAppliedAt: row?.last_applied_at ?? null,
        hasFailedMigration: Number(row?.failed_count ?? 0) > 0
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010" && String(error.meta?.code) === "42P01") {
        throw new MigrationsTableUnavailableError("Tabela de migrations indisponivel.");
      }
      throw error;
    }
  }
};
