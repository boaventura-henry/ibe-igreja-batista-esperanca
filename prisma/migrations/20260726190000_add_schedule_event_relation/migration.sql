-- Associate schedules with events without duplicating repertoire history.
ALTER TABLE "Schedule" ADD COLUMN "eventId" TEXT;

CREATE INDEX "Schedule_eventId_idx" ON "Schedule"("eventId");
CREATE INDEX "ScheduleSong_songId_deletedAt_idx" ON "ScheduleSong"("songId", "deletedAt");

ALTER TABLE "Schedule"
ADD CONSTRAINT "Schedule_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
