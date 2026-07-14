import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { songService } from "@/services";
import { songUpdateSchema } from "@/validators";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: NextRequest, context: Context) { try { await requirePermission("song.view"); return apiSuccess(await songService.getById((await context.params).id)); } catch (error) { const app = toAppError(error); return apiError(app.message, app.statusCode, app.code); } }
export async function PUT(request: NextRequest, context: Context) { try { const user = await requirePermission("song.update"); return apiSuccess(await songService.update((await context.params).id, songUpdateSchema.parse(await request.json()), user.id)); } catch (error) { if (error instanceof ZodError) return apiError(error.issues[0]?.message ?? "Dados invalidos.", 400, "VALIDATION_ERROR"); const app = toAppError(error); return apiError(app.message, app.statusCode, app.code); } }
export async function DELETE(_: NextRequest, context: Context) { try { const user = await requirePermission("song.delete"); return apiSuccess(await songService.remove((await context.params).id, user.id)); } catch (error) { const app = toAppError(error); return apiError(app.message, app.statusCode, app.code); } }
