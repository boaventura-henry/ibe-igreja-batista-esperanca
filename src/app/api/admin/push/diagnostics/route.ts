import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { diagnoseVapidPrivateKey, diagnoseVapidPublicKey, diagnoseVapidSubject } from "@/utils/vapid-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function environment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export async function GET() {
  try {
    await requirePermission("dashboard.admin.view");
    const response = apiSuccess({
      environment: environment(),
      ...diagnoseVapidPublicKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      ...diagnoseVapidPrivateKey(process.env.VAPID_PRIVATE_KEY),
      ...diagnoseVapidSubject(process.env.VAPID_SUBJECT)
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const appError = toAppError(error);
    return apiError(appError.message, appError.statusCode, appError.code);
  }
}