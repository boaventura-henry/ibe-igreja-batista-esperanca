import { Prisma } from "@prisma/client";
import { applicationDateOnlyCutoff, applicationDayStart } from "@/lib/application-time";
import {
  lifecycleRepository,
  type LifecycleKind
} from "@/repositories/lifecycle.repository";

export const DEFAULT_LIFECYCLE_BATCH_SIZE = 100;
export const MAX_LIFECYCLE_TRANSACTION_ATTEMPTS = 3;

const TRANSIENT_TRANSACTION_CODES = new Set(["P2034", "40001", "40P01"]);

type LifecycleResult = {
  executed: boolean;
  lockAcquired: boolean;
  found: number;
  updated: number;
  cancelledReminders?: number;
};

function lockedOut(): LifecycleResult {
  return { executed: false, lockAcquired: false, found: 0, updated: 0 };
}

function nestedTransientCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    code?: unknown;
    meta?: { code?: unknown } | null;
    cause?: unknown;
  };
  if (typeof candidate.code === "string" && TRANSIENT_TRANSACTION_CODES.has(candidate.code)) {
    return candidate.code;
  }
  if (
    typeof candidate.meta?.code === "string" &&
    TRANSIENT_TRANSACTION_CODES.has(candidate.meta.code)
  ) {
    return candidate.meta.code;
  }
  return candidate.cause ? nestedTransientCode(candidate.cause) : null;
}

export function transientLifecycleTransactionCode(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    TRANSIENT_TRANSACTION_CODES.has(error.code)
  ) {
    return error.code;
  }
  return nestedTransientCode(error);
}

async function runProcessor(
  processor: LifecycleKind,
  operation: (attempt: number) => Promise<LifecycleResult>
) {
  const startedAt = performance.now();
  for (let attempt = 1; attempt <= MAX_LIFECYCLE_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      const result = await operation(attempt);
      console.info("[AutomaticLifecycle] processor completed.", {
        processor,
        attempt,
        executed: result.executed,
        lockAcquired: result.lockAcquired,
        found: result.found,
        updated: result.updated,
        cancelledReminders: result.cancelledReminders ?? 0,
        durationMs: Number((performance.now() - startedAt).toFixed(3))
      });
      return result;
    } catch (error) {
      const code = transientLifecycleTransactionCode(error);
      const willRetry = Boolean(code) && attempt < MAX_LIFECYCLE_TRANSACTION_ATTEMPTS;
      const details = {
        processor,
        attempt,
        code,
        errorName: error instanceof Error ? error.name : "UnknownError",
        willRetry,
        durationMs: Number((performance.now() - startedAt).toFixed(3))
      };
      if (willRetry) {
        console.warn("[AutomaticLifecycle] transient transaction failure.", details);
        continue;
      }
      console.error("[AutomaticLifecycle] processor failed.", details);
      throw error;
    }
  }
  throw new Error("Automatic lifecycle retry limit reached.");
}

export const lifecycleService = {
  processExpiredSchedules(now = new Date(), limit = DEFAULT_LIFECYCLE_BATCH_SIZE) {
    const cutoff = applicationDateOnlyCutoff(now);
    return runProcessor("schedules", () =>
      lifecycleRepository.transaction(async (database): Promise<LifecycleResult> => {
        if (!(await lifecycleRepository.tryAcquireLock("schedules", database))) return lockedOut();
        const candidates = await lifecycleRepository.listExpiredScheduleIds(cutoff, limit, database);
        const result = await lifecycleRepository.completeSchedules(
          candidates.map(({ id }) => id),
          cutoff,
          database
        );
        return {
          executed: true,
          lockAcquired: true,
          found: candidates.length,
          updated: result.count,
          cancelledReminders: result.cancelledReminders
        };
      })
    );
  },

  processExpiredEvents(now = new Date(), limit = DEFAULT_LIFECYCLE_BATCH_SIZE) {
    const cutoff = applicationDateOnlyCutoff(now);
    return runProcessor("events", () =>
      lifecycleRepository.transaction(async (database): Promise<LifecycleResult> => {
        if (!(await lifecycleRepository.tryAcquireLock("events", database))) return lockedOut();
        const candidates = await lifecycleRepository.listExpiredEventIds(cutoff, limit, database);
        const result = await lifecycleRepository.archiveEvents(
          candidates.map(({ id }) => id),
          cutoff,
          database
        );
        return {
          executed: true,
          lockAcquired: true,
          found: candidates.length,
          updated: result.count,
          cancelledReminders: result.cancelledReminders
        };
      })
    );
  },

  processExpiredAnnouncements(now = new Date(), limit = DEFAULT_LIFECYCLE_BATCH_SIZE) {
    const cutoff = applicationDayStart(now);
    return runProcessor("announcements", () =>
      lifecycleRepository.transaction(async (database): Promise<LifecycleResult> => {
        if (!(await lifecycleRepository.tryAcquireLock("announcements", database))) return lockedOut();
        const candidates = await lifecycleRepository.listExpiredAnnouncementIds(cutoff, limit, database);
        const result = await lifecycleRepository.archiveAnnouncements(
          candidates.map(({ id }) => id),
          cutoff,
          database
        );
        return { executed: true, lockAcquired: true, found: candidates.length, updated: result.count };
      })
    );
  }
};
