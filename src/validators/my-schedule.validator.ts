import { z } from "zod";

export const myScheduleDeclineSchema = z.object({
  declineReason: z.string().trim().max(500, "O motivo deve ter ate 500 caracteres.").optional()
});

export const myScheduleListQuerySchema = z.object({
  includeCompleted: z.preprocess(
    (value) => value === "true" ? true : value === "false" || value === undefined ? false : value,
    z.boolean().optional()
  )
});

export type MyScheduleDeclineInput = z.infer<typeof myScheduleDeclineSchema>;
export type MyScheduleListQueryInput = z.infer<typeof myScheduleListQuerySchema>;
