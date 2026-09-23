import { z } from "zod";

export const ministryFinancialAccessUpdateSchema = z.object({
  ministryIds: z.array(z.string().cuid()).max(200).default([])
});

export type MinistryFinancialAccessUpdateInput = z.infer<typeof ministryFinancialAccessUpdateSchema>;
