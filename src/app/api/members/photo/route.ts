import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxSize = 4 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser();

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return apiError("Upload de fotos ainda nao configurado.", 503, "BLOB_NOT_CONFIGURED");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("Selecione uma foto valida.", 400, "INVALID_FILE");
    }

    if (!acceptedTypes.includes(file.type)) {
      return apiError("Use uma imagem JPG, PNG ou WebP.", 400, "INVALID_FILE_TYPE");
    }

    if (file.size > maxSize) {
      return apiError("A foto deve ter no maximo 4 MB.", 400, "FILE_TOO_LARGE");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const blob = await put(`members/${crypto.randomUUID()}.${extension}`, file, {
      access: "public",
      addRandomSuffix: false
    });

    return apiSuccess({
      url: blob.url
    });
  } catch (error) {
    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
