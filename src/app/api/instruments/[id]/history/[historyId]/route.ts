import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { instrumentHistoryService } from "@/services";
import { instrumentHistoryUpdateSchema } from "@/validators";
type Context={params:Promise<{id:string;historyId:string}>};
export async function PUT(request:NextRequest,context:Context){try{const user=await requirePermission("instrument.history.update");const {id,historyId}=await context.params;const current=await instrumentHistoryService.getById(historyId);if(current.instrumentId!==id)return apiError("Historico do instrumento nao encontrado.",404,"INSTRUMENT_HISTORY_NOT_FOUND");return apiSuccess(await instrumentHistoryService.update(historyId,instrumentHistoryUpdateSchema.parse(await request.json()),user.id));}catch(error){if(error instanceof ZodError)return apiError(error.issues[0]?.message??"Dados invalidos.",400,"VALIDATION_ERROR");const app=toAppError(error);return apiError(app.message,app.statusCode,app.code)}}
