import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { myScheduleService } from "@/services";
export const dynamic = "force-dynamic";
export async function GET(_: Request, context: { params: Promise<{ scheduleMemberId: string }> }) { try { const user = await requirePermission("mySchedule.view"); return apiSuccess(await myScheduleService.getRepertoire((await context.params).scheduleMemberId, user)); } catch (error) { const app = toAppError(error); return apiError(app.message, app.statusCode, app.code); } }
