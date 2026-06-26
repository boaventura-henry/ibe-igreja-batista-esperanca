import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requireCurrentUser, requireRole } from "@/lib/session";
import { accessRoleService } from "@/services";
import { accessRoleCreateSchema } from "@/validators";

export const dynamic = "force-dynamic";

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function GET() {
  try {
    const user = await requireCurrentUser();

    if (user.role !== "ADMIN") {
      return apiError("Voce nao tem permissao para esta acao.", 403, "FORBIDDEN");
    }

    return apiSuccess(await accessRoleService.list());
  } catch (error) {
    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["ADMIN"]);
    const payload = accessRoleCreateSchema.parse(await request.json());
    const accessRole = await accessRoleService.create(payload, user.id);

    return apiSuccess(accessRole, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(validationMessage(error), 400, "VALIDATION_ERROR");
    }

    if (error instanceof AppError) {
      return apiError(error.message, error.statusCode, error.code);
    }

    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
