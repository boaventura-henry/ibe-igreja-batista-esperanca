import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { ministryService } from "@/services";
import { ministryCreateSchema, ministryListQuerySchema } from "@/validators";

export const dynamic = "force-dynamic";

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("ministry.view");
    const filters = ministryListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    return apiSuccess(await ministryService.list(filters));
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

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("ministry.create");
    const payload = ministryCreateSchema.parse(await request.json());

    return apiSuccess(await ministryService.create(payload, user.id), { status: 201 });
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
