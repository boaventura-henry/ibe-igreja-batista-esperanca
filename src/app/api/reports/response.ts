import { apiSuccess } from "@/lib/api-response";
import type { ReportFileResult, ReportRunResult } from "@/types";

function isFileResult(result: ReportRunResult): result is ReportFileResult {
  return "body" in result;
}

export function reportResponse(result: ReportRunResult) {
  if (!isFileResult(result)) {
    return apiSuccess(result);
  }

  return new Response(Buffer.from(result.body), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
