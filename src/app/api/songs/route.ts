import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { songService } from "@/services";
import { songCreateSchema, songListQuerySchema } from "@/validators";

export const dynamic = "force-dynamic";
const message = (error: ZodError) => error.issues[0]?.message ?? "Dados invalidos.";
export async function GET(request: NextRequest) { try { await requirePermission("song.view"); return apiSuccess(await songService.list(songListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams)))); } catch (error) { if (error instanceof ZodError) return apiError(message(error), 400, "VALIDATION_ERROR"); const app = toAppError(error); return apiError(app.message, app.statusCode, app.code); } }
export async function POST(request: NextRequest) { try { const user = await requirePermission("song.create"); return apiSuccess(await songService.create(songCreateSchema.parse(await request.json()), user.id), { status: 201 }); } catch (error) { if (error instanceof ZodError) return apiError(message(error), 400, "VALIDATION_ERROR"); if (error instanceof AppError) return apiError(error.message, error.statusCode, error.code); const app = toAppError(error); return apiError(app.message, app.statusCode, app.code); } }
