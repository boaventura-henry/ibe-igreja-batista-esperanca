-- AlterTable: User access management fields.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- Rename Permission.key/group to the final domain language, preserving data.
ALTER TABLE "Permission" RENAME COLUMN "key" TO "code";
ALTER TABLE "Permission" RENAME COLUMN "group" TO "module";

-- Add Permission.name while preserving existing friendly labels.
ALTER TABLE "Permission" ADD COLUMN "name" TEXT;
UPDATE "Permission" SET "name" = COALESCE(NULLIF("label", ''), "code");
ALTER TABLE "Permission" ALTER COLUMN "name" SET NOT NULL;

-- Keep index names aligned with the final Prisma schema.
ALTER INDEX IF EXISTS "Permission_key_key" RENAME TO "Permission_code_key";
ALTER INDEX IF EXISTS "Permission_key_idx" RENAME TO "Permission_code_idx";
ALTER INDEX IF EXISTS "Permission_group_idx" RENAME TO "Permission_module_idx";
