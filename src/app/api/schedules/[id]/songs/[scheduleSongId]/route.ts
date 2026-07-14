import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { scheduleSongService } from "@/services";
import { scheduleSongUpdateSchema } from "@/validators";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; scheduleSongId: string }> };
export async function PUT(request: NextRequest, context: Context) { try { const user = await requirePermission("schedule.update"); const params = await context.params; return apiSuccess(await scheduleSongService.update(params.id, params.scheduleSongId, scheduleSongUpdateSchema.parse(await request.json()), user.id)); } catch (error) { if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR"); const app = toAppError(error); return apiError(app.message, app.statusCode, app.code); } }
export async function DELETE(_: NextRequest, context: Context) { try { const user = await requirePermission("schedule.update"); const params = await context.params; return apiSuccess(await scheduleSongService.remove(params.id, params.scheduleSongId, user.id)); } catch (error) { const app = toAppError(error); return apiError(app.message, app.statusCode, app.code); } }
