import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { apiError, apiSuccess } from "@/lib/api-response";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { scheduleNotificationService } from "@/services/schedule-notification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

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
    console.error("[ScheduleReminderCron] execution failed.", {
      executionId,
      errorName: error instanceof Error ? error.name : "UnknownError",
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
