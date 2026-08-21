import { z } from "zod";

export const instrumentUsageHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type InstrumentUsageHistoryQueryInput = z.infer<
  typeof instrumentUsageHistoryQuerySchema
>;
