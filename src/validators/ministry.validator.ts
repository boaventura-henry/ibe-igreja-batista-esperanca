import { MinistryIcon, WeekDay } from "@prisma/client";
import { z } from "zod";
import { onlyDigits } from "@/utils";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const optionalText = z.preprocess(emptyToNull, z.string().trim().nullable().optional());
const optionalFilterText = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalEmail = z.preprocess(
  emptyToNull,
  z.string().trim().email("Informe um e-mail valido.").nullable().optional()
);
const optionalMemberId = z.preprocess(emptyToNull, z.string().cuid().nullable().optional());
const optionalFilterMemberId = z.preprocess(emptyToUndefined, z.string().cuid().optional());
const optionalPhone = z.preprocess(
  emptyToNull,
  z
    .string()
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length >= 10, "Informe um telefone valido.")
    .nullable()
    .optional()
);

const ministryBaseSchema = z.object({
    name: z.string().trim().min(2, "Informe o nome do ministerio."),
    description: optionalText,
    color: z
      .string()
      .trim()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Informe uma cor hexadecimal valida.")
      .default("#2563eb"),
    icon: z.enum(MinistryIcon).default(MinistryIcon.USERS),
    imageUrl: optionalText,
    displayOrder: z.coerce.number().int().min(1, "A ordem deve ser maior ou igual a um.").optional(),
    email: optionalEmail,
    phone: optionalPhone,
    meetingDay: z.preprocess(emptyToNull, z.enum(WeekDay).nullable().optional()),
    meetingTime: z.preprocess(
      emptyToNull,
      z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horario valido.").nullable().optional()
    ),
    location: optionalText,
    notes: optionalText,
    isActive: z.boolean().default(true),
    leaderMemberId: optionalMemberId,
    viceLeaderMemberId: optionalMemberId
  });

const differentLeadersRefinement = {
  message: "Lider e vice-lider nao podem ser a mesma pessoa.",
  path: ["viceLeaderMemberId"]
};

export const ministryCreateSchema = ministryBaseSchema.refine(
    (data) =>
      !data.leaderMemberId ||
      !data.viceLeaderMemberId ||
      data.leaderMemberId !== data.viceLeaderMemberId,
    differentLeadersRefinement
  );

export const ministryUpdateSchema = ministryBaseSchema.partial().refine(
  (data) =>
    !data.leaderMemberId ||
    !data.viceLeaderMemberId ||
    data.leaderMemberId !== data.viceLeaderMemberId,
  differentLeadersRefinement
);

export const ministryListQuerySchema = z.object({
  search: optionalFilterText,
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  leaderMemberId: optionalFilterMemberId,
  sortBy: z
    .enum(["name", "displayOrder", "createdAt", "updatedAt", "meetingDay", "isActive"])
    .default("displayOrder"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type MinistryCreateInput = z.infer<typeof ministryCreateSchema>;
export type MinistryUpdateInput = z.infer<typeof ministryUpdateSchema>;
export type MinistryListQueryInput = z.infer<typeof ministryListQuerySchema>;
