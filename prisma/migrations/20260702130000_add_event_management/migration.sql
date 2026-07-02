-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SERVICE', 'CONFERENCE', 'MEETING', 'CLASS', 'COURSE', 'REHEARSAL', 'VIGIL', 'RETREAT', 'OUTREACH', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "slug" TEXT;
ALTER TABLE "Event" ADD COLUMN "type" "EventType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Event" ADD COLUMN "status" "EventStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Event" ADD COLUMN "responsibleMemberId" TEXT;
ALTER TABLE "Event" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "startTime" TEXT;
ALTER TABLE "Event" ADD COLUMN "endTime" TEXT;
ALTER TABLE "Event" ADD COLUMN "address" TEXT;
ALTER TABLE "Event" ADD COLUMN "capacity" INTEGER;
ALTER TABLE "Event" ADD COLUMN "requiresRegistration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN "observations" TEXT;
ALTER TABLE "Event" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Event" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "Event" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- DataMigration
UPDATE "Event"
SET
  "startDate" = COALESCE("startsAt", CURRENT_TIMESTAMP),
  "endDate" = "endsAt",
  "slug" = lower(
    trim(
      both '-'
      from regexp_replace(
        regexp_replace("title", '[^A-Za-z0-9]+', '-', 'g'),
        '-+',
        '-',
        'g'
      )
    )
  ) || '-' || substr("id", 1, 8)
WHERE "startDate" IS NULL OR "slug" IS NULL;

UPDATE "Event"
SET "slug" = 'evento-' || substr("id", 1, 8)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "Event" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "startDate" SET NOT NULL;

-- DropOldColumns
ALTER TABLE "Event" DROP COLUMN IF EXISTS "startsAt";
ALTER TABLE "Event" DROP COLUMN IF EXISTS "endsAt";

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_title_idx" ON "Event"("title");
CREATE INDEX "Event_slug_idx" ON "Event"("slug");
CREATE INDEX "Event_type_idx" ON "Event"("type");
CREATE INDEX "Event_status_idx" ON "Event"("status");
CREATE INDEX "Event_ministryId_idx" ON "Event"("ministryId");
CREATE INDEX "Event_responsibleMemberId_idx" ON "Event"("responsibleMemberId");
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");
CREATE INDEX "Event_endDate_idx" ON "Event"("endDate");
CREATE INDEX "Event_isPublic_idx" ON "Event"("isPublic");
CREATE INDEX "Event_deletedAt_idx" ON "Event"("deletedAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
