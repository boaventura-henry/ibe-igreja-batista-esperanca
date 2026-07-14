import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { scheduleSongService } from "@/services";
import { scheduleSongCopySchema } from "@/validators";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) { try { const user = await requirePermission("schedule.update"); return apiSuccess(await scheduleSongService.copy((await context.params).id, scheduleSongCopySchema.parse(await request.json()), user.id)); } catch (error) { if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR"); const app = toAppError(error); return apiError(app.message, app.statusCode, app.code); } }
