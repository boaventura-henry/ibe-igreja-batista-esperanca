import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
const invalid=(e:ZodError)=>apiError(e.issues[0]?.message??"Dados invalidos.",400,"VALIDATION_ERROR");
import { instrumentService } from "@/services"; import { instrumentCreateSchema, instrumentListQuerySchema } from "@/validators"; export const dynamic="force-dynamic"; export async function GET(r:NextRequest){try{await requirePermission("instrument.view");return apiSuccess(await instrumentService.list(instrumentListQuerySchema.parse(Object.fromEntries(r.nextUrl.searchParams))));}catch(e){return e instanceof ZodError?invalid(e):apiError(toAppError(e).message,toAppError(e).statusCode,toAppError(e).code)}} export async function POST(r:NextRequest){try{const u=await requirePermission("instrument.create");return apiSuccess(await instrumentService.create(instrumentCreateSchema.parse(await r.json()),u.id),{status:201});}catch(e){return e instanceof ZodError?invalid(e):apiError(toAppError(e).message,toAppError(e).statusCode,toAppError(e).code)}}