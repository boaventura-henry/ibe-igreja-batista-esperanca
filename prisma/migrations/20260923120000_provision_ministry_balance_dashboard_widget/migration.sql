INSERT INTO "DashboardWidget" (
    "id",
    "code",
    "title",
    "description",
    "category",
    "sensitivity",
    "priority",
    "defaultSize",
    "defaultVisibleOnMobile",
    "defaultVisibleOnTablet",
    "defaultVisibleOnDesktop",
    "iconKey",
    "visualVariant",
    "permissionId",
    "defaultOrder",
    "isEnabled",
    "isSystem",
    "createdAt",
    "updatedAt"
)
SELECT
    'dashboard_finance_ministry_balances',
    'finance.ministryBalances',
    'Saldo por ministerio',
    'Saldos acumulados dos ministerios com movimentacao.',
    'FINANCE'::"DashboardWidgetCategory",
    'RESTRICTED'::"DashboardWidgetSensitivity",
    'NORMAL'::"DashboardWidgetPriority",
    'MEDIUM'::"DashboardWidgetSize",
    true,
    true,
    true,
    'WALLET'::"DashboardWidgetIconKey",
    'RESTRICTED'::"DashboardWidgetVisualVariant",
    "Permission"."id",
    95,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Permission"
WHERE "Permission"."code" = 'dashboard.finance.ministryBalances'
ON CONFLICT ("code") DO NOTHING;
