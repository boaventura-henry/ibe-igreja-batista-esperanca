import { ScheduleMemberRole, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalDateTime = z.preprocess(emptyToUndefined, z.string().datetime().optional());

const timeSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horario valido.").optional()
);

const scheduleBaseSchema = z.object({
  title: z.string().trim().min(3, "Informe o titulo da escala."),
  description: optionalText,
  ministryId: z.string().cuid("Informe um ministerio valido."),
  date: z.string().date("Informe uma data valida."),
  startTime: timeSchema,
  endTime: timeSchema,
  location: optionalText,
  status: z.enum(ScheduleStatus).default(ScheduleStatus.DRAFT),
  observations: optionalText
});

function validateScheduleTimes<T extends { startTime?: string; endTime?: string }>(
  data: T,
  context: z.RefinementCtx
) {
  if (data.startTime && data.endTime && data.endTime < data.startTime) {
    context.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "O horario final nao pode ser anterior ao inicio."
    });
  }
}

export const scheduleCreateSchema = scheduleBaseSchema.superRefine(validateScheduleTimes);
export const scheduleUpdateSchema = scheduleBaseSchema.partial().superRefine(validateScheduleTimes);

export const scheduleListQuerySchema = z.object({
  search: optionalText,
  ministryId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  status: z.enum(ScheduleStatus).optional(),
  dateFrom: z.preprocess(emptyToUndefined, z.string().date().optional()),
  dateTo: z.preprocess(emptyToUndefined, z.string().date().optional()),
  sortBy: z.enum(["date", "title", "status", "createdAt", "updatedAt"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

const scheduleMemberBaseSchema = z.object({
  memberId: z.string().cuid("Informe um membro valido."),
  role: z.enum(ScheduleMemberRole),
  status: z.enum(ScheduleMemberStatus),
  confirmedAt: optionalDateTime,
  replacedByMemberId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  observations: optionalText,
  allowMinistryException: z.boolean()
});

export const scheduleMemberCreateSchema = scheduleMemberBaseSchema.extend({
  role: z.enum(ScheduleMemberRole).default(ScheduleMemberRole.OTHER),
  status: z.enum(ScheduleMemberStatus).default(ScheduleMemberStatus.PENDING),
  allowMinistryException: z.boolean().default(false)
});

export const scheduleMemberUpdateSchema = scheduleMemberBaseSchema.partial();

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;
export type ScheduleListQueryInput = z.infer<typeof scheduleListQuerySchema>;
export type ScheduleMemberCreateInput = z.infer<typeof scheduleMemberCreateSchema>;
export type ScheduleMemberUpdateInput = z.infer<typeof scheduleMemberUpdateSchema>;
