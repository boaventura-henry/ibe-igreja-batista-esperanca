import { z } from "zod";

const endpointSchema = z.string().trim().min(1, "Inscrição inválida.").max(2048, "Inscrição inválida.").refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "A inscrição deve usar HTTPS.");

const keySchema = z.string().trim().min(1, "Inscrição inválida.").max(512, "Inscrição inválida.");

export const pushSubscribeSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({ p256dh: keySchema, auth: keySchema }).strict(),
  expirationTime: z.number().finite().nonnegative().nullable().optional(),
  deviceName: z.string().trim().max(100).nullable().optional(),
  userAgent: z.string().trim().max(512).nullable().optional()
}).strict();

export const pushUnsubscribeSchema = z.object({
  endpoint: endpointSchema.optional(),
  id: z.string().trim().min(1).max(100).optional()
}).refine((value) => Boolean(value.endpoint || value.id), "Informe o dispositivo a desativar.").strict();

export const pushPreferencesSchema = z.object({ pushEnabled: z.boolean() }).strict();

export const pushTestFeedbackSchema = z.object({
  endpoint: endpointSchema,
  received: z.boolean()
}).strict();

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
export type PushPreferencesInput = z.infer<typeof pushPreferencesSchema>;
export type PushTestFeedbackInput = z.infer<typeof pushTestFeedbackSchema>;
