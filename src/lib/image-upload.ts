import { AppError } from "@/lib/errors";

export const MAX_IMAGE_UPLOAD_SIZE = 4 * 1024 * 1024;

type SafeImageType = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function detectImageType(bytes: Uint8Array): SafeImageType | null {
  if (bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (bytes.length >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

export async function validateImageUpload(file: File) {
  if (file.size <= 0) {
    throw new AppError("Selecione uma imagem valida.", 400, "INVALID_FILE");
  }

  if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
    throw new AppError("A imagem deve ter no maximo 4 MB.", 400, "FILE_TOO_LARGE");
  }

  const detected = detectImageType(new Uint8Array(await file.arrayBuffer()));

  if (!detected) {
    throw new AppError("Use uma imagem JPG, PNG ou WebP valida.", 400, "INVALID_FILE_TYPE");
  }

  return detected;
}
