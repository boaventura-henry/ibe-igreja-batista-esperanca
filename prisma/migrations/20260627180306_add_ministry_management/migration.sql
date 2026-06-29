/*
  Warnings:

  - You are about to drop the column `leaderName` on the `Ministry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Ministry" DROP COLUMN "leaderName",
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#2563eb',
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'users',
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaderMemberId" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "meetingDay" TEXT,
ADD COLUMN     "meetingTime" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "viceLeaderMemberId" TEXT;

-- AlterTable
ALTER TABLE "Permission" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "_AccessRolePermissions" ADD CONSTRAINT "_AccessRolePermissions_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_AccessRolePermissions_AB_unique";

-- CreateIndex
CREATE INDEX "Ministry_name_idx" ON "Ministry"("name");

-- CreateIndex
CREATE INDEX "Ministry_displayOrder_idx" ON "Ministry"("displayOrder");

-- CreateIndex
CREATE INDEX "Ministry_isActive_idx" ON "Ministry"("isActive");

-- CreateIndex
CREATE INDEX "Ministry_deletedAt_idx" ON "Ministry"("deletedAt");

-- CreateIndex
CREATE INDEX "Ministry_leaderMemberId_idx" ON "Ministry"("leaderMemberId");

-- CreateIndex
CREATE INDEX "Ministry_viceLeaderMemberId_idx" ON "Ministry"("viceLeaderMemberId");

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_leaderMemberId_fkey" FOREIGN KEY ("leaderMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_viceLeaderMemberId_fkey" FOREIGN KEY ("viceLeaderMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
