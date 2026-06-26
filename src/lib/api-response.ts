import { NextResponse } from "next/server";
import type { ApiErrorBody, ApiSuccessBody } from "@/types/api";

export function apiSuccess<TData>(data: TData, init?: ResponseInit) {
  return NextResponse.json<ApiSuccessBody<TData>>(
    {
      success: true,
      ...(typeof data === "object" && data !== null ? data : {}),
      data
    } as ApiSuccessBody<TData>,
    init
  );
}

export function apiError(message: string, status = 500, code = "INTERNAL_ERROR") {
  return NextResponse.json<ApiErrorBody>(
    {
      success: false,
      error: {
        code,
        message
      }
    },
    { status }
  );
}
