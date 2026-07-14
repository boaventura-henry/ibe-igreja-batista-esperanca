import { z } from "zod";
import { isSafeExternalUrl, isYouTubeUrl, normalizeMusicKey, normalizeYouTubeUrl } from "@/utils/music";

const optionalText = z.preprocess((value) => typeof value === "string" && value.trim() ? value.trim() : undefined, z.string().optional());
const optionalUrl = optionalText.refine(isSafeExternalUrl, "Informe uma URL HTTP ou HTTPS valida.");

const songFields = z.object({
  title: z.string().trim().min(1, "Informe o titulo da musica.").max(160),
  artist: optionalText,
  youtubeUrl: optionalUrl.refine(isYouTubeUrl, "Informe um link valido do YouTube.").transform(normalizeYouTubeUrl),
  referenceKey: optionalText.transform(normalizeMusicKey),
  resourceUrl: optionalUrl,
  simplifiedResourceUrl: optionalUrl,
  notes: optionalText,
  isActive: z.boolean()
});

export const songCreateSchema = songFields.extend({ isActive: z.boolean().default(true) });
export const songUpdateSchema = songFields.partial();
export const songListQuerySchema = z.object({
  search: optionalText,
  artist: optionalText,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  sortBy: z.enum(["title", "artist", "createdAt", "lastUsedAt"]).default("title"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type SongCreateInput = z.infer<typeof songCreateSchema>;
export type SongUpdateInput = z.infer<typeof songUpdateSchema>;
export type SongListQueryInput = z.infer<typeof songListQuerySchema>;
