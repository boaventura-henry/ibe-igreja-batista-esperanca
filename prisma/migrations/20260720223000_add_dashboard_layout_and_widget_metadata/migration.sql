CREATE TYPE "DashboardWidgetCategory" AS ENUM ('MEMBERS', 'MINISTRIES', 'EVENTS', 'SCALES', 'FINANCE', 'CONTRIBUTIONS', 'ANNOUNCEMENTS', 'NOTIFICATIONS', 'SYSTEM');
CREATE TYPE "DashboardWidgetSensitivity" AS ENUM ('PUBLIC', 'INTERNAL', 'RESTRICTED');
CREATE TYPE "DashboardWidgetPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "DashboardWidgetSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'FULL');
CREATE TYPE "DashboardWidgetIconKey" AS ENUM ('USERS', 'CAKE', 'CALENDAR', 'MUSIC', 'WALLET', 'TRENDING_UP', 'HAND_COINS', 'MEGAPHONE', 'BELL', 'HEART_PULSE', 'SERVER', 'SHIELD');
CREATE TYPE "DashboardWidgetVisualVariant" AS ENUM ('DEFAULT', 'INFO', 'POSITIVE', 'WARNING', 'DANGER', 'RESTRICTED');
CREATE TYPE "DashboardLayoutMode" AS ENUM ('COMPACT', 'BALANCED', 'EXPANDED');

ALTER TABLE "DashboardWidget"
  ALTER COLUMN "category" TYPE "DashboardWidgetCategory" USING ("category"::"DashboardWidgetCategory"),
  ADD COLUMN "sensitivity" "DashboardWidgetSensitivity" NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN "priority" "DashboardWidgetPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "defaultSize" "DashboardWidgetSize" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "defaultVisibleOnMobile" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "defaultVisibleOnTablet" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "defaultVisibleOnDesktop" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "iconKey" "DashboardWidgetIconKey" NOT NULL DEFAULT 'SERVER',
  ADD COLUMN "visualVariant" "DashboardWidgetVisualVariant" NOT NULL DEFAULT 'DEFAULT';

ALTER TABLE "AccessRoleDashboardWidget"
  ADD COLUMN "size" "DashboardWidgetSize",
  ADD COLUMN "visibleOnMobile" BOOLEAN,
  ADD COLUMN "visibleOnTablet" BOOLEAN,
  ADD COLUMN "visibleOnDesktop" BOOLEAN;

CREATE TABLE "AccessRoleDashboardLayout" (
  "id" TEXT NOT NULL,
  "accessRoleId" TEXT NOT NULL,
  "layoutMode" "DashboardLayoutMode" NOT NULL DEFAULT 'BALANCED',
  "desktopColumns" INTEGER NOT NULL DEFAULT 3,
  "tabletColumns" INTEGER NOT NULL DEFAULT 2,
  "mobileColumns" INTEGER NOT NULL DEFAULT 1,
  "showCategoryHeaders" BOOLEAN NOT NULL DEFAULT true,
  "allowCategoryCollapse" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessRoleDashboardLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessRoleDashboardLayout_accessRoleId_key" ON "AccessRoleDashboardLayout"("accessRoleId");
CREATE INDEX "AccessRoleDashboardLayout_accessRoleId_idx" ON "AccessRoleDashboardLayout"("accessRoleId");
ALTER TABLE "AccessRoleDashboardLayout" ADD CONSTRAINT "AccessRoleDashboardLayout_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
