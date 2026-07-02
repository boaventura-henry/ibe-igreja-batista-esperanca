import { EventStatus, EventType } from "@prisma/client";
import { z } from "zod";

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
const optionalCuid = z.preprocess(emptyToNull, z.string().cuid().nullable().optional());
const optionalFilterCuid = z.preprocess(emptyToUndefined, z.string().cuid().optional());
const optionalTime = z.preprocess(
  emptyToNull,
  z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horario valido.").nullable().optional()
);
const optionalCapacity = z.preprocess(
  emptyToNull,
  z.coerce.number().int().positive("A capacidade deve ser maior que zero.").nullable().optional()
);

const eventBaseObjectSchema = z.object({
  title: z.string().trim().min(2, "Informe o titulo do evento."),
  description: optionalText,
  type: z.enum(EventType),
  status: z.enum(EventStatus),
  ministryId: optionalCuid,
  responsibleMemberId: optionalCuid,
  startDate: z.coerce.date({ message: "Informe a data inicial." }),
  endDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  startTime: optionalTime,
  endTime: optionalTime,
  location: optionalText,
  address: optionalText,
  capacity: optionalCapacity,
  requiresRegistration: z.boolean(),
  isPublic: z.boolean(),
  imageUrl: optionalText,
  observations: optionalText
});

export const eventCreateSchema = eventBaseObjectSchema.extend({
  type: z.enum(EventType).default(EventType.OTHER),
  status: z.enum(EventStatus).default(EventStatus.DRAFT),
  requiresRegistration: z.boolean().default(false),
  isPublic: z.boolean().default(false)
}).refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "A data final nao pode ser menor que a data inicial.",
    path: ["endDate"]
  });

export const eventUpdateSchema = eventBaseObjectSchema.partial().refine(
  (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
  {
    message: "A data final nao pode ser menor que a data inicial.",
    path: ["endDate"]
  }
);

export const eventListQuerySchema = z.object({
  search: optionalFilterText,
  type: z.preprocess(emptyToUndefined, z.enum(EventType).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(EventStatus).optional()),
  ministryId: optionalFilterCuid,
  startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  isPublic: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  sortBy: z.enum(["title", "startDate", "endDate", "createdAt", "updatedAt", "status", "type"]).default("startDate"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type EventListQueryInput = z.infer<typeof eventListQuerySchema>;
