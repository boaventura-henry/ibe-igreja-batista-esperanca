CREATE TYPE "ScheduleInstrumentSource" AS ENUM ('REGISTERED', 'OWN');
CREATE TABLE "ScheduleMemberInstrumentAssignment" (
    "id" TEXT NOT NULL,
    "scheduleMemberId" TEXT NOT NULL,
    "instrumentCategoryId" TEXT NOT NULL,
    "source" "ScheduleInstrumentSource" NOT NULL,
    "instrumentId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "changeReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduleMemberInstrumentAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScheduleMemberInstrumentAssignment_source_instrument_check" CHECK ((("source" = 'REGISTERED') AND ("instrumentId" IS NOT NULL)) OR (("source" = 'OWN') AND ("instrumentId" IS NULL)))
);
CREATE INDEX "ScheduleMemberInstrumentAssignment_scheduleMemberId_idx" ON "ScheduleMemberInstrumentAssignment"("scheduleMemberId");
CREATE INDEX "ScheduleMemberInstrumentAssignment_instrumentId_startedAt_idx" ON "ScheduleMemberInstrumentAssignment"("instrumentId", "startedAt");
CREATE INDEX "ScheduleMemberInstrumentAssignment_instrumentCategoryId_idx" ON "ScheduleMemberInstrumentAssignment"("instrumentCategoryId");
CREATE INDEX "ScheduleMemberInstrumentAssignment_startedAt_idx" ON "ScheduleMemberInstrumentAssignment"("startedAt");
CREATE INDEX "ScheduleMemberInstrumentAssignment_endedAt_idx" ON "ScheduleMemberInstrumentAssignment"("endedAt");
CREATE UNIQUE INDEX "ScheduleMemberInstrumentAssignment_one_active_per_member" ON "ScheduleMemberInstrumentAssignment"("scheduleMemberId") WHERE "endedAt" IS NULL;
ALTER TABLE "ScheduleMemberInstrumentAssignment" ADD CONSTRAINT "ScheduleMemberInstrumentAssignment_scheduleMemberId_fkey" FOREIGN KEY ("scheduleMemberId") REFERENCES "ScheduleMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleMemberInstrumentAssignment" ADD CONSTRAINT "ScheduleMemberInstrumentAssignment_instrumentCategoryId_fkey" FOREIGN KEY ("instrumentCategoryId") REFERENCES "InstrumentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleMemberInstrumentAssignment" ADD CONSTRAINT "ScheduleMemberInstrumentAssignment_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleMemberInstrumentAssignment" ADD CONSTRAINT "ScheduleMemberInstrumentAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleMemberInstrumentAssignment" ADD CONSTRAINT "ScheduleMemberInstrumentAssignment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;