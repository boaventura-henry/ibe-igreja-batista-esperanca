import { z } from "zod";

const exportFormatSchema = z.enum(["view", "pdf", "xlsx", "csv"]).default("view");
const sortOrderSchema = z.enum(["asc", "desc"]).default("asc");

const baseReportSchema = z.object({
  exportFormat: exportFormatSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema
});

export const memberReportSchema = baseReportSchema.extend({
  filters: z.object({
    name: z.string().trim().optional(),
    status: z.string().trim().optional(),
    ministryId: z.string().trim().optional(),
    city: z.string().trim().optional(),
    createdFrom: z.string().trim().optional(),
    createdTo: z.string().trim().optional()
  }).default({})
});

export const ministryReportSchema = baseReportSchema.extend({
  filters: z.object({
    status: z.string().trim().optional(),
    leaderMemberId: z.string().trim().optional(),
    meetingDay: z.string().trim().optional()
  }).default({})
});

export const scheduleReportSchema = baseReportSchema.extend({
  filters: z.object({
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    ministryId: z.string().trim().optional(),
    status: z.string().trim().optional(),
    memberId: z.string().trim().optional()
  }).default({})
});

export const eventReportSchema = baseReportSchema.extend({
  filters: z.object({
    type: z.string().trim().optional(),
    status: z.string().trim().optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    ministryId: z.string().trim().optional()
  }).default({})
});

export const financialReportSchema = baseReportSchema.extend({
  filters: z.object({
    categoryId: z.string().trim().optional(),
    type: z.string().trim().optional(),
    paymentMethod: z.string().trim().optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    ministryId: z.string().trim().optional(),
    eventId: z.string().trim().optional(),
    memberId: z.string().trim().optional()
  }).default({})
});

export const portalContributionReportSchema = z.object({
  exportFormat: z.enum(["pdf", "xlsx", "csv"]).default("pdf")
});

export type MemberReportInput = z.infer<typeof memberReportSchema>;
export type MinistryReportInput = z.infer<typeof ministryReportSchema>;
export type ScheduleReportInput = z.infer<typeof scheduleReportSchema>;
export type EventReportInput = z.infer<typeof eventReportSchema>;
export type FinancialReportInput = z.infer<typeof financialReportSchema>;
export type PortalContributionReportInput = z.infer<typeof portalContributionReportSchema>;
