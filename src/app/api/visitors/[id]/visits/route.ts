import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { visitorService } from "@/services";
import { visitorListQuerySchema } from "@/validators";

type Context = { params: Promise<{ id: string }> };

function failure(error: unknown) {
  if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
  const appError = toAppError(error);
  return apiError(appError.message, appError.statusCode, appError.code);
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: Context) {
  try {
    await requirePermission("visitor.view");
    const query = visitorListQuerySchema.pick({ page: true, pageSize: true }).parse(Object.fromEntries(request.nextUrl.searchParams));
    return apiSuccess(await visitorService.listVisits((await context.params).id, query));
  } catch (error) {
    return failure(error);
  }
}
