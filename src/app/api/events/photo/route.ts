import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toAppError } from "@/lib/errors";
import { requireAnyPermission } from "@/lib/session";

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxSize = 4 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAnyPermission(["event.create", "event.update"]);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return apiError("Upload de imagens ainda nao configurado.", 503, "BLOB_NOT_CONFIGURED");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("Selecione uma imagem valida.", 400, "INVALID_FILE");
    }

    if (!acceptedTypes.includes(file.type)) {
      return apiError("Use uma imagem JPG, PNG ou WebP.", 400, "INVALID_FILE_TYPE");
    }

    if (file.size > maxSize) {
      return apiError("A imagem deve ter no maximo 4 MB.", 400, "FILE_TOO_LARGE");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const blob = await put(`events/${crypto.randomUUID()}.${extension}`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type
    });

    return apiSuccess({
      url: blob.url
    });
  } catch (error) {
    const appError = toAppError(error);

    return apiError(appError.message, appError.statusCode, appError.code);
  }
}
