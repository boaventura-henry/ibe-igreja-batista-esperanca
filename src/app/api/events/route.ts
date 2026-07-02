import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { eventService } from "@/services";
import { eventCreateSchema, eventListQuerySchema } from "@/validators";

export const dynamic = "force-dynamic";

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Dados invalidos.";
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("event.view");
    const filters = eventListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));

    return apiSuccess(await eventService.list(filters));
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
    const user = await requirePermission("event.create");
    const payload = eventCreateSchema.parse(await request.json());

    return apiSuccess(await eventService.create(payload, user.id), { status: 201 });
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
