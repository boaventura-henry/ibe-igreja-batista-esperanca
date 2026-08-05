ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

CREATE INDEX "Event_status_endDate_startDate_deletedAt_idx"
ON "Event"("status", "endDate", "startDate", "deletedAt");
