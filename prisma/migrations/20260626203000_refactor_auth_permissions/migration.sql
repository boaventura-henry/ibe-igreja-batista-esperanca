-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "group" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AccessRolePermissions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_key_idx" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_group_idx" ON "Permission"("group");

-- CreateIndex
CREATE INDEX "Permission_isActive_idx" ON "Permission"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "_AccessRolePermissions_AB_unique" ON "_AccessRolePermissions"("A", "B");

-- CreateIndex
CREATE INDEX "_AccessRolePermissions_B_index" ON "_AccessRolePermissions"("B");

-- Seed known permissions before migrating AccessRole.permissions.
INSERT INTO "Permission" ("id", "key", "label", "group", "isSystem", "isActive", "createdAt", "updatedAt")
SELECT
  'perm_' || md5(value."key"),
  value."key",
  value."label",
  value."group",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('member.view', 'Visualizar membros', 'Membros'),
    ('member.create', 'Criar membros', 'Membros'),
    ('member.update', 'Editar membros', 'Membros'),
    ('member.delete', 'Excluir membros', 'Membros'),
    ('accessRole.view', 'Visualizar perfis', 'Perfis de acesso'),
    ('accessRole.create', 'Criar perfis', 'Perfis de acesso'),
    ('accessRole.update', 'Editar perfis', 'Perfis de acesso'),
    ('accessRole.delete', 'Excluir perfis', 'Perfis de acesso')
) AS value("key", "label", "group")
ON CONFLICT ("key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group" = EXCLUDED."group",
  "isSystem" = true,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Preserve any non-standard permission keys already stored in AccessRole.permissions.
INSERT INTO "Permission" ("id", "key", "label", "group", "isSystem", "isActive", "createdAt", "updatedAt")
SELECT DISTINCT
  'perm_' || md5(permission_key),
  permission_key,
  permission_key,
  'Legado',
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AccessRole", unnest("permissions") AS permission_key
WHERE permission_key IS NOT NULL
ON CONFLICT ("key") DO NOTHING;

-- Migrate AccessRole.permissions String[] to the relation table.
INSERT INTO "_AccessRolePermissions" ("A", "B")
SELECT DISTINCT
  role."id",
  permission."id"
FROM "AccessRole" role
CROSS JOIN LATERAL unnest(role."permissions") AS permission_key
INNER JOIN "Permission" permission ON permission."key" = permission_key
ON CONFLICT DO NOTHING;

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "memberId" TEXT,
ADD COLUMN "accessRoleId" TEXT;

-- Migrate Member.accessRoleId to User.accessRoleId where User and Member share the same email.
UPDATE "User" AS app_user
SET "memberId" = member."id"
FROM "Member" AS member
WHERE app_user."memberId" IS NULL
  AND member."email" IS NOT NULL
  AND lower(app_user."email") = lower(member."email");

UPDATE "User" AS app_user
SET "accessRoleId" = member."accessRoleId"
FROM "Member" AS member
WHERE app_user."memberId" = member."id"
  AND member."accessRoleId" IS NOT NULL;

-- Keep current ADMIN users with the system administrator access role when available.
UPDATE "User" AS app_user
SET "accessRoleId" = role."id"
FROM "AccessRole" AS role
WHERE app_user."role" = 'ADMIN'
  AND app_user."accessRoleId" IS NULL
  AND role."name" = 'Administrador'
  AND role."deletedAt" IS NULL;

-- Drop old Member access-role relation.
ALTER TABLE "Member" DROP CONSTRAINT IF EXISTS "Member_accessRoleId_fkey";
DROP INDEX IF EXISTS "Member_accessRoleId_idx";
ALTER TABLE "Member" DROP COLUMN IF EXISTS "accessRoleId";

-- Drop old array storage after relation migration.
ALTER TABLE "AccessRole" DROP COLUMN "permissions";

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- CreateIndex
CREATE INDEX "User_accessRoleId_idx" ON "User"("accessRoleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AccessRolePermissions" ADD CONSTRAINT "_AccessRolePermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AccessRolePermissions" ADD CONSTRAINT "_AccessRolePermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
