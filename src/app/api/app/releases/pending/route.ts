import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { appReleaseService } from "@/services/app-release.service";

export const dynamic = "force-dynamic";
const noStore = { headers: { "Cache-Control": "no-store, max-age=0" } };

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const release = await appReleaseService.getPendingReleaseForUser(user.id);
    return apiSuccess({ hasPendingRelease: Boolean(release), release }, noStore);
  } catch (error) {
    const appError = toAppError(error);
    const response = apiError(appError.message, appError.statusCode, appError.code);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }
}
