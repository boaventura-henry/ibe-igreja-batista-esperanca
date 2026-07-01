import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { accessRequestService } from "@/services";
import { accessRequestRejectSchema } from "@/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("accessRequest.reject");
    const { id } = await params;
    const payload = accessRequestRejectSchema.parse(await request.json());

    return apiSuccess(await accessRequestService.reject(id, payload, user.id));
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
    }

    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
