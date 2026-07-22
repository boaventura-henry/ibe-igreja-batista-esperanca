import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { validateImageUpload } from "@/lib/image-upload";
import { requirePermission } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requirePermission("member.photo.upload");

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return apiError("Upload de fotos ainda nao configurado.", 503, "BLOB_NOT_CONFIGURED");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("Selecione uma foto valida.", 400, "INVALID_FILE");
    }

    const { extension, contentType } = await validateImageUpload(file);
    const blob = await put(`members/${crypto.randomUUID()}.${extension}`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType
    });

    return apiSuccess({
      url: blob.url
    });
  } catch (error) {
    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
