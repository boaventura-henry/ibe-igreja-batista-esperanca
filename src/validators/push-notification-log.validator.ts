import { PushNotificationLogStatus } from "@prisma/client";
import { z } from "zod";

export const pushNotificationLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(10),
  status: z.nativeEnum(PushNotificationLogStatus).optional().or(z.literal("")),
  search: z.string().trim().max(120).optional().catch(""),
  target: z.string().trim().max(120).optional().catch(""),
  userId: z.string().trim().max(80).optional().catch(""),
  from: z.string().trim().optional().catch(""),
  to: z.string().trim().optional().catch("")
});

export type PushNotificationLogListQuery = z.infer<typeof pushNotificationLogListQuerySchema>;