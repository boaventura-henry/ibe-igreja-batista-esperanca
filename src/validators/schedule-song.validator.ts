import { z } from "zod";
import { isSafeExternalUrl, normalizeMusicKey } from "@/utils/music";

const optionalText = z.preprocess((value) => typeof value === "string" && value.trim() ? value.trim() : undefined, z.string().optional());
const optionalUrl = optionalText.refine(isSafeExternalUrl, "Informe uma URL HTTP ou HTTPS valida.");

const fields = z.object({
  songId: z.string().cuid("Informe uma musica valida."),
  position: z.coerce.number().int().min(1, "A posicao deve ser maior que zero.").optional(),
  referenceKey: optionalText.transform(normalizeMusicKey),
  performanceKey: optionalText.transform(normalizeMusicKey),
  leadMemberId: z.preprocess((value) => typeof value === "string" && value.trim() ? value : undefined, z.string().cuid().optional()),
  youtubeUrlOverride: optionalUrl,
  resourceUrlOverride: optionalUrl,
  useSimplifiedVersion: z.boolean(),
  notes: optionalText
});

export const scheduleSongCreateSchema = fields.extend({ useSimplifiedVersion: z.boolean().default(false) });
export const scheduleSongUpdateSchema = fields.partial();
export const scheduleSongCopySchema = z.object({
  sourceScheduleId: z.string().cuid(),
  mode: z.enum(["replace", "append"])
});
export type ScheduleSongCreateInput = z.infer<typeof scheduleSongCreateSchema>;
export type ScheduleSongUpdateInput = z.infer<typeof scheduleSongUpdateSchema>;
export type ScheduleSongCopyInput = z.infer<typeof scheduleSongCopySchema>;
