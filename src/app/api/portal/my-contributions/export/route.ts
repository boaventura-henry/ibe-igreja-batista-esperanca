import { ZodError } from "zod";
import { apiError } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { reportService } from "@/services";
import { portalContributionReportSchema } from "@/validators";
import { reportResponse } from "@/app/api/reports/response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("memberContribution.view");
    const payload = portalContributionReportSchema.parse(await request.json());

    return reportResponse(await reportService.portalContributions(user.memberId, payload));
  } catch (error) {
    if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
    if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code);
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
