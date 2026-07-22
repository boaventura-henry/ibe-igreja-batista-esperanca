import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { appReleaseService } from "@/services/app-release.service";
import { releaseSeenSchema } from "@/validators/app-release.validator";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const payload = releaseSeenSchema.parse(await request.json());
    return apiSuccess(await appReleaseService.markReleaseAsSeen({ userId: user.id, version: payload.version }), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const appError = error instanceof ZodError ? { message: error.issues[0]?.message ?? "Dados invalidos.", statusCode: 400, code: "VALIDATION_ERROR" } : toAppError(error);
    const response = apiError(appError.message, appError.statusCode, appError.code);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }
}
