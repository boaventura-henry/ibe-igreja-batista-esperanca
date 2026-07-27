import { ScheduleStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(160).optional()
);

const optionalCuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().cuid().optional()
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().date().optional()
);

export const songUsageHistoryQuerySchema = z
  .object({
    search: optionalText,
    ministryId: optionalCuid,
    eventId: optionalCuid,
    status: z.enum(ScheduleStatus).optional(),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(50).default(10)
  })
  .superRefine((data, context) => {
    if (data.dateFrom && data.dateTo && data.dateTo < data.dateFrom) {
      context.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "A data final nao pode ser anterior a data inicial."
      });
    }
  });

export type SongUsageHistoryQueryInput = z.infer<typeof songUsageHistoryQuerySchema>;
