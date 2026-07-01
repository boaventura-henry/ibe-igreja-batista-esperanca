-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ScheduleMemberStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'REPLACED', 'ABSENT');

-- CreateEnum
CREATE TYPE "ScheduleMemberRole" AS ENUM ('LEADER', 'VOCAL', 'INSTRUMENT', 'MEDIA', 'RECEPTION', 'CHILDREN', 'SUPPORT', 'OTHER');

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ministryId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "observations" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleMember" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "ScheduleMemberRole" NOT NULL DEFAULT 'OTHER',
    "status" "ScheduleMemberStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "replacedByMemberId" TEXT,
    "observations" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_title_idx" ON "Schedule"("title");

-- CreateIndex
CREATE INDEX "Schedule_ministryId_idx" ON "Schedule"("ministryId");

-- CreateIndex
CREATE INDEX "Schedule_date_idx" ON "Schedule"("date");

-- CreateIndex
CREATE INDEX "Schedule_status_idx" ON "Schedule"("status");

-- CreateIndex
CREATE INDEX "Schedule_deletedAt_idx" ON "Schedule"("deletedAt");

-- CreateIndex
CREATE INDEX "ScheduleMember_scheduleId_idx" ON "ScheduleMember"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleMember_memberId_idx" ON "ScheduleMember"("memberId");

-- CreateIndex
CREATE INDEX "ScheduleMember_role_idx" ON "ScheduleMember"("role");

-- CreateIndex
CREATE INDEX "ScheduleMember_status_idx" ON "ScheduleMember"("status");

-- CreateIndex
CREATE INDEX "ScheduleMember_replacedByMemberId_idx" ON "ScheduleMember"("replacedByMemberId");

-- CreateIndex
CREATE INDEX "ScheduleMember_deletedAt_idx" ON "ScheduleMember"("deletedAt");

-- CreateIndex
CREATE INDEX "ScheduleMember_scheduleId_memberId_deletedAt_idx" ON "ScheduleMember"("scheduleId", "memberId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleMember" ADD CONSTRAINT "ScheduleMember_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleMember" ADD CONSTRAINT "ScheduleMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleMember" ADD CONSTRAINT "ScheduleMember_replacedByMemberId_fkey" FOREIGN KEY ("replacedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleMember" ADD CONSTRAINT "ScheduleMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleMember" ADD CONSTRAINT "ScheduleMember_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
