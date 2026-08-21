import { ScheduleInstrumentSource } from "@prisma/client";
import { z } from "zod";

export const myScheduleDeclineSchema = z.object({
  declineReason: z.string().trim().max(500, "O motivo deve ter ate 500 caracteres.").optional()
});

export const myScheduleInstrumentChangeSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal(ScheduleInstrumentSource.REGISTERED), instrumentId: z.string().cuid(), changeReason: z.string().trim().max(500).nullable().optional(), currentAssignmentId: z.string().cuid() }),
  z.object({ source: z.literal(ScheduleInstrumentSource.OWN), instrumentId: z.null().optional().default(null), changeReason: z.string().trim().max(500).nullable().optional(), currentAssignmentId: z.string().cuid() })
]);

export const myScheduleListQuerySchema = z.object({
  includeCompleted: z.preprocess(
    (value) => value === "true" ? true : value === "false" || value === undefined ? false : value,
    z.boolean().optional()
  )
});

export type MyScheduleDeclineInput = z.infer<typeof myScheduleDeclineSchema>;
export type MyScheduleInstrumentChangeInput = z.infer<typeof myScheduleInstrumentChangeSchema>;
export type MyScheduleListQueryInput = z.infer<typeof myScheduleListQuerySchema>;
