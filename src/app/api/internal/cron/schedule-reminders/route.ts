import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api-response";
import { authorizeCronRequest } from "@/lib/cron-auth";
import {
  scheduleNotificationService,
  scheduleReminderProcessingErrorContext
} from "@/services/schedule-notification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

function sanitizeDiagnosticText(value: string) {
  return value
    .replace(/\b(?:postgres(?:ql)?):\/\/\S+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(
      /\b(CRON_SECRET|DATABASE_URL|DIRECT_URL|Authorization)\s*[:=]\s*\S+/gi,
      "$1=[REDACTED]"
    )
    .slice(0, 2_000);
}

function safePrismaMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return null;
  const source = meta as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  const safeKeys = [
    "code",
    "message",
    "modelName",
    "target",
    "column",
    "constraint",
    "table",
    "field_name",
    "database_error"
  ];
  for (const key of safeKeys) {
    const value = source[key];
    if (typeof value === "string") {
      sanitized[key] = sanitizeDiagnosticText(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 20).map((item) =>
        typeof item === "string" ? sanitizeDiagnosticText(item) : item
      );
    }
  }
  return sanitized;
}

export async function GET(request: Request) {
  const requestStartedAt = performance.now();
  const authenticationStartedAt = performance.now();
  const authorization = authorizeCronRequest(request);
  const authenticationMs = Number(
    (performance.now() - authenticationStartedAt).toFixed(3)
  );
  if (!authorization.authorized) {
    if (authorization.status === 503) {
      console.error("[ScheduleReminderCron] CRON_SECRET is not configured.");
    }
    const response = apiError(
      authorization.message,
      authorization.status,
      authorization.code
    );
    response.headers.set("Cache-Control", noStoreHeaders["Cache-Control"]);
    return response;
  }

  const executionId = randomUUID();
  console.info("[ScheduleReminderCron] execution started.", {
    executionId,
    authenticationMs
  });

  try {
    const result = await scheduleNotificationService.processPendingReminders();
    console.info("[ScheduleReminderCron] execution completed.", {
      executionId,
      executed: result.executed,
      reason: result.reason,
      selected: result.found,
      sent: result.sent,
      cancelled: result.cancelled,
      skipped: result.skipped,
      lockAcquired: result.lockAcquired,
      attempts: result.attempts,
      timings: result.timings,
      requestDurationMs: Number((performance.now() - requestStartedAt).toFixed(3))
    });

    return apiSuccess(
      {
        executionId,
        ...result
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    const processingError = scheduleReminderProcessingErrorContext(error);
    const originalError = processingError.error;
    const prismaError =
      originalError instanceof Prisma.PrismaClientKnownRequestError
        ? originalError
        : null;
    console.error("[ScheduleReminderCron] execution failed.", {
      executionId,
      phase: processingError.phase,
      attempt: processingError.attempt,
      error: {
        name:
          prismaError?.name ??
          (originalError instanceof Error ? originalError.name : "UnknownError"),
        code: prismaError?.code ?? null,
        message: sanitizeDiagnosticText(
          prismaError?.message ??
            (originalError instanceof Error
              ? originalError.message
              : "Unknown processing error.")
        ),
        meta: prismaError ? safePrismaMeta(prismaError.meta) : null,
        clientVersion: prismaError?.clientVersion ?? null
      },
      requestDurationMs: Number((performance.now() - requestStartedAt).toFixed(3))
    });
    const response = apiError(
      "Nao foi possivel processar os lembretes.",
      500,
      "SCHEDULE_REMINDER_PROCESSING_FAILED"
    );
    response.headers.set("Cache-Control", noStoreHeaders["Cache-Control"]);
    return response;
  }
}
