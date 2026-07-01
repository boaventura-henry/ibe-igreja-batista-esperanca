import { z } from "zod";

export const myScheduleDeclineSchema = z.object({
  declineReason: z.string().trim().max(500, "O motivo deve ter ate 500 caracteres.").optional()
});

export type MyScheduleDeclineInput = z.infer<typeof myScheduleDeclineSchema>;
