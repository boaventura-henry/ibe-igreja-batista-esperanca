import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { visitorService } from "@/services";
import { visitorAdminUpdateSchema } from "@/validators";

type Context = { params: Promise<{ id: string }> };

function failure(error: unknown) {
  if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR");
  if (error instanceof SyntaxError) return apiError("JSON invalido.", 400, "VALIDATION_ERROR");
  const appError = toAppError(error);
  return apiError(appError.message, appError.statusCode, appError.code);
}

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, context: Context) {
  try {
    await requirePermission("visitor.view");
    return apiSuccess(await visitorService.getDetail((await context.params).id));
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const user = await requirePermission("visitor.update");
    const input = visitorAdminUpdateSchema.parse(await request.json());
    return apiSuccess(await visitorService.updateAdmin((await context.params).id, input, user.id));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(_: NextRequest, context: Context) {
  try {
    const user = await requirePermission("visitor.delete");
    return apiSuccess(await visitorService.removeAdmin((await context.params).id, user.id));
  } catch (error) {
    return failure(error);
  }
}
