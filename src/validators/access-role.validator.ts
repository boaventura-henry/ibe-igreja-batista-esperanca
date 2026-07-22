import { z } from "zod";
import { permissionCodes } from "@/lib/permissions";
import { dashboardWidgetCodes } from "@/config/dashboard-widgets";
import { dashboardLayoutModes, dashboardWidgetSizes } from "@/config/dashboard-widget-enums";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export const accessRoleCreateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do perfil."),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  permissions: z.array(z.enum(permissionCodes)).default([]),
  isActive: z.boolean().default(true),
  dashboardWidgets: z.array(z.object({
    code: z.enum(dashboardWidgetCodes),
    isVisible: z.boolean(),
    sortOrder: z.number().int().min(0).max(10000).nullable().optional(),
    size: z.enum(dashboardWidgetSizes).nullable().optional(),
    visibleOnMobile: z.boolean().nullable().optional(),
    visibleOnTablet: z.boolean().nullable().optional(),
    visibleOnDesktop: z.boolean().nullable().optional()
  })).refine((items) => new Set(items.map((item) => item.code)).size === items.length, "Existem cards duplicados.").default([]),
  dashboardLayout: z.object({
    mode: z.enum(dashboardLayoutModes).default("BALANCED"),
    desktopColumns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(3),
    tabletColumns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    mobileColumns: z.union([z.literal(1), z.literal(2)]).default(1),
    showCategoryHeaders: z.boolean().default(true),
    allowCategoryCollapse: z.boolean().default(true)
  }).default({
    mode: "BALANCED",
    desktopColumns: 3,
    tabletColumns: 2,
    mobileColumns: 1,
    showCategoryHeaders: true,
    allowCategoryCollapse: true
  })
});

export const accessRoleUpdateSchema = accessRoleCreateSchema.partial().extend({
  confirmSystemChange: z.boolean().optional()
});

export type AccessRoleCreateInput = z.infer<typeof accessRoleCreateSchema>;
export type AccessRoleUpdateInput = z.infer<typeof accessRoleUpdateSchema>;
