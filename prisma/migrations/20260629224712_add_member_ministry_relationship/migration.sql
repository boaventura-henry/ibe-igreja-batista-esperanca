/*
  Warnings:

  - The legacy `_MemberMinistries` table is migrated into `MemberMinistry` before being dropped.

*/
-- CreateEnum
CREATE TYPE "MemberMinistryRole" AS ENUM ('LEADER', 'VICE_LEADER', 'SECRETARY', 'TREASURER', 'VOLUNTEER', 'MEMBER');

-- CreateEnum
CREATE TYPE "MemberMinistryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED', 'REMOVED', 'LEFT');

-- CreateTable
CREATE TABLE "MemberMinistry" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "role" "MemberMinistryRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MemberMinistryStatus" NOT NULL DEFAULT 'ACTIVE',
    "entryDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3),
    "observations" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberMinistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberMinistry_memberId_idx" ON "MemberMinistry"("memberId");

-- CreateIndex
CREATE INDEX "MemberMinistry_ministryId_idx" ON "MemberMinistry"("ministryId");

-- CreateIndex
CREATE INDEX "MemberMinistry_status_idx" ON "MemberMinistry"("status");

-- CreateIndex
CREATE INDEX "MemberMinistry_role_idx" ON "MemberMinistry"("role");

-- CreateIndex
CREATE INDEX "MemberMinistry_entryDate_idx" ON "MemberMinistry"("entryDate");

-- CreateIndex
CREATE INDEX "MemberMinistry_exitDate_idx" ON "MemberMinistry"("exitDate");

-- CreateIndex
CREATE INDEX "MemberMinistry_deletedAt_idx" ON "MemberMinistry"("deletedAt");

-- CreateIndex
CREATE INDEX "MemberMinistry_memberId_ministryId_status_deletedAt_idx" ON "MemberMinistry"("memberId", "ministryId", "status", "deletedAt");

-- Preserve legacy implicit member-ministry links as active historical records.
INSERT INTO "MemberMinistry" (
    "id",
    "memberId",
    "ministryId",
    "role",
    "status",
    "entryDate",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_' || md5(old_links."A" || ':' || old_links."B"),
    old_links."A",
    old_links."B",
    'MEMBER',
    'ACTIVE',
    COALESCE(member_record."joinedAt", member_record."createdAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_MemberMinistries" old_links
INNER JOIN "Member" member_record ON member_record."id" = old_links."A"
INNER JOIN "Ministry" ministry_record ON ministry_record."id" = old_links."B"
WHERE member_record."deletedAt" IS NULL
  AND ministry_record."deletedAt" IS NULL
ON CONFLICT ("id") DO NOTHING;

-- DropForeignKey
ALTER TABLE "_MemberMinistries" DROP CONSTRAINT "_MemberMinistries_A_fkey";

-- DropForeignKey
ALTER TABLE "_MemberMinistries" DROP CONSTRAINT "_MemberMinistries_B_fkey";

-- DropTable
DROP TABLE "_MemberMinistries";

-- AddForeignKey
ALTER TABLE "MemberMinistry" ADD CONSTRAINT "MemberMinistry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMinistry" ADD CONSTRAINT "MemberMinistry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMinistry" ADD CONSTRAINT "MemberMinistry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMinistry" ADD CONSTRAINT "MemberMinistry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
