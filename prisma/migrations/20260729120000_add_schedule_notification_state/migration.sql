-- Add publication state used by the internal notification integration.
ALTER TABLE "Schedule"
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "notificationVersion" INTEGER NOT NULL DEFAULT 0;

-- Existing published/completed schedules are historical publications. This
-- prevents retroactive notifications while allowing future updates/reminders.
UPDATE "Schedule"
SET
  "publishedAt" = COALESCE("updatedAt", "createdAt"),
  "notificationVersion" = 1
WHERE "status" IN ('PUBLISHED', 'COMPLETED');

CREATE INDEX "Schedule_status_date_publishedAt_deletedAt_idx"
ON "Schedule"("status", "date", "publishedAt", "deletedAt");
