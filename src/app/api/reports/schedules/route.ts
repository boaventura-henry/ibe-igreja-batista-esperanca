import { ZodError } from "zod";
import { apiError } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { reportService } from "@/services";
import { scheduleReportSchema } from "@/validators";
import { reportResponse } from "../response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = scheduleReportSchema.parse(await request.json());
    const authorization = await requireScheduleAccess(
      payload.exportFormat === "view" ? "report.view" : "report.export"
    );

    return reportResponse(await reportService.schedules(payload, authorization));
  } catch (error) {
    if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
