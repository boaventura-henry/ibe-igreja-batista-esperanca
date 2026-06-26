import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { healthService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await healthService.checkDatabase();

    return apiSuccess(health);
  } catch (error) {
    const appError = toAppError(error);

    return apiError("Database unavailable", appError.statusCode, "DATABASE_UNAVAILABLE");
  }
}
