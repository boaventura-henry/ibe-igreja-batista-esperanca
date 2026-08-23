import { ScheduleInstrumentSource } from "@prisma/client";
import { z } from "zod";

const cuid = z.string().cuid();

export const scheduleInstrumentAssignmentSchema = z.discriminatedUnion("source", [
  z.object({
    instrumentCategoryId: cuid,
    source: z.literal(ScheduleInstrumentSource.REGISTERED),
    instrumentId: cuid,
    changeReason: z.string().trim().max(500).nullable().optional()
  }),
  z.object({
    instrumentCategoryId: cuid,
    source: z.literal(ScheduleInstrumentSource.OWN),
    instrumentId: z.null().optional().default(null),
    changeReason: z.string().trim().max(500).nullable().optional()
  })
]);

export const eligibleScheduleInstrumentsQuerySchema = z.object({
  categoryId: cuid
});

export const scheduleInstrumentSuggestionQuerySchema = z.object({
  memberId: cuid
});

export type ScheduleInstrumentAssignmentInput = z.infer<typeof scheduleInstrumentAssignmentSchema>;
