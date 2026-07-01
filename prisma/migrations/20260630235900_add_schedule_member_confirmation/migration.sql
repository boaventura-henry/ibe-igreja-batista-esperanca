-- AlterTable
ALTER TABLE "ScheduleMember"
ADD COLUMN "declinedAt" TIMESTAMP(3),
ADD COLUMN "declineReason" TEXT;

-- CreateIndex
CREATE INDEX "ScheduleMember_confirmedAt_idx" ON "ScheduleMember"("confirmedAt");

-- CreateIndex
CREATE INDEX "ScheduleMember_declinedAt_idx" ON "ScheduleMember"("declinedAt");
