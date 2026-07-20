import { z } from "zod";

export const pushNotificationHealthQuerySchema = z.object({
  thresholdDays: z.coerce.number().int().min(1).max(365).catch(30)
});

export const pushNotificationDeviceHealthQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(20)
});

export type PushNotificationHealthQuery = z.infer<typeof pushNotificationHealthQuerySchema>;
export type PushNotificationDeviceHealthQuery = z.infer<typeof pushNotificationDeviceHealthQuerySchema>;
