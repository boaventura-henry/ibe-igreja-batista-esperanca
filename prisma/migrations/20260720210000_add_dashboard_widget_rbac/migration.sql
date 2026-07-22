-- CreateTable
CREATE TABLE "DashboardWidget" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "defaultOrder" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRoleDashboardWidget" (
    "id" TEXT NOT NULL,
    "accessRoleId" TEXT NOT NULL,
    "dashboardWidgetId" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccessRoleDashboardWidget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DashboardWidget_code_key" ON "DashboardWidget"("code");
CREATE INDEX "DashboardWidget_permissionId_idx" ON "DashboardWidget"("permissionId");
CREATE INDEX "DashboardWidget_category_defaultOrder_idx" ON "DashboardWidget"("category", "defaultOrder");
CREATE INDEX "DashboardWidget_isEnabled_idx" ON "DashboardWidget"("isEnabled");
CREATE UNIQUE INDEX "AccessRoleDashboardWidget_accessRoleId_dashboardWidgetId_key" ON "AccessRoleDashboardWidget"("accessRoleId", "dashboardWidgetId");
CREATE INDEX "AccessRoleDashboardWidget_accessRoleId_isVisible_idx" ON "AccessRoleDashboardWidget"("accessRoleId", "isVisible");
CREATE INDEX "AccessRoleDashboardWidget_dashboardWidgetId_idx" ON "AccessRoleDashboardWidget"("dashboardWidgetId");

ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessRoleDashboardWidget" ADD CONSTRAINT "AccessRoleDashboardWidget_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessRoleDashboardWidget" ADD CONSTRAINT "AccessRoleDashboardWidget_dashboardWidgetId_fkey" FOREIGN KEY ("dashboardWidgetId") REFERENCES "DashboardWidget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
