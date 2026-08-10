-- Event publication and reminder state reuse the internal notification pipeline.
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER';

ALTER TABLE "Event"
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "notificationVersion" INTEGER NOT NULL DEFAULT 0;

-- Existing published and historical events must not notify retroactively.
UPDATE "Event"
SET
  "publishedAt" = COALESCE("updatedAt", "createdAt"),
  "notificationVersion" = 1
WHERE "status" IN ('PUBLISHED', 'COMPLETED', 'ARCHIVED');

CREATE INDEX "Event_status_startDate_publishedAt_deletedAt_idx"
ON "Event"("status", "startDate", "publishedAt", "deletedAt");
