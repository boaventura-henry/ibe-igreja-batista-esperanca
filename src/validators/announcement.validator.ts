import { AnnouncementAudience, AnnouncementStatus } from "@prisma/client";
import { z } from "zod";
import { isSafeExternalUrl } from "@/utils/url";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const optionalUrl = z.preprocess(
  emptyToNull,
  z.string().trim().max(2048).refine(isSafeExternalUrl, "Informe uma URL HTTP ou HTTPS valida.").nullable().optional()
);
const optionalFilterText = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalCuid = z.preprocess(emptyToNull, z.string().cuid().nullable().optional());
const optionalFilterCuid = z.preprocess(emptyToUndefined, z.string().cuid().optional());
const optionalDate = z.preprocess(emptyToNull, z.coerce.date().nullable().optional());

const announcementBaseSchema = z.object({
  title: z.string().trim().min(2, "Informe o titulo do comunicado."),
  content: z.string().trim().min(2, "Informe o conteudo do comunicado."),
  status: z.enum(AnnouncementStatus),
  audience: z.enum(AnnouncementAudience),
  ministryId: optionalCuid,
  isPinned: z.boolean(),
  publishAt: optionalDate,
  expiresAt: optionalDate,
  externalLink: optionalUrl
});

function validateAnnouncementRange(data: {
  publishAt?: Date | null;
  expiresAt?: Date | null;
  audience?: AnnouncementAudience;
  ministryId?: string | null;
}) {
  if (data.publishAt && data.expiresAt && data.expiresAt < data.publishAt) {
    return false;
  }

  return true;
}

function validateAudience(data: { audience?: AnnouncementAudience; ministryId?: string | null }) {
  return data.audience !== AnnouncementAudience.MINISTRY || Boolean(data.ministryId);
}

export const announcementCreateSchema = announcementBaseSchema
  .extend({
    status: z.enum(AnnouncementStatus).default(AnnouncementStatus.DRAFT),
    audience: z.enum(AnnouncementAudience).default(AnnouncementAudience.ALL),
    isPinned: z.boolean().default(false)
  })
  .refine(validateAnnouncementRange, {
    message: "A data de expiracao nao pode ser menor que a data de publicacao.",
    path: ["expiresAt"]
  })
  .refine(validateAudience, {
    message: "Informe o ministerio para comunicados direcionados a um ministerio.",
    path: ["ministryId"]
  });

export const announcementUpdateSchema = announcementBaseSchema
  .omit({ status: true })
  .partial()
  .refine(validateAnnouncementRange, {
    message: "A data de expiracao nao pode ser menor que a data de publicacao.",
    path: ["expiresAt"]
  })
  .refine(validateAudience, {
    message: "Informe o ministerio para comunicados direcionados a um ministerio.",
    path: ["ministryId"]
  });

export const announcementListQuerySchema = z.object({
  search: optionalFilterText,
  status: z.preprocess(emptyToUndefined, z.enum(AnnouncementStatus).optional()),
  audience: z.preprocess(emptyToUndefined, z.enum(AnnouncementAudience).optional()),
  ministryId: optionalFilterCuid,
  sortBy: z.enum(["title", "status", "audience", "publishAt", "expiresAt", "createdAt", "updatedAt"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;
export type AnnouncementListQueryInput = z.infer<typeof announcementListQuerySchema>;
