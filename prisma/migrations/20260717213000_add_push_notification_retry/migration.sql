-- AlterEnum
ALTER TYPE "PushNotificationLogDeviceStatus" ADD VALUE 'SKIPPED';

-- AlterEnum
ALTER TYPE "PushNotificationTargetType" ADD VALUE 'RETRY_FAILED';

-- AlterTable
ALTER TABLE "PushNotificationLog" ADD COLUMN     "devicesSkipped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "originalLogId" TEXT,
ADD COLUMN     "retriedById" TEXT,
ADD COLUMN     "retryLockKey" TEXT,
ADD COLUMN     "retryNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retrySourceLogId" TEXT;

-- AlterTable
ALTER TABLE "PushNotificationLogDevice" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "skipReason" TEXT,
ADD COLUMN     "sourceLogDeviceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PushNotificationLog_retryLockKey_key" ON "PushNotificationLog"("retryLockKey");

-- CreateIndex
CREATE UNIQUE INDEX "PushNotificationLog_idempotencyKey_key" ON "PushNotificationLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PushNotificationLog_originalLogId_idx" ON "PushNotificationLog"("originalLogId");

-- CreateIndex
CREATE INDEX "PushNotificationLog_retrySourceLogId_idx" ON "PushNotificationLog"("retrySourceLogId");

-- CreateIndex
CREATE INDEX "PushNotificationLog_retryNumber_idx" ON "PushNotificationLog"("retryNumber");

-- CreateIndex
CREATE INDEX "PushNotificationLog_retriedById_idx" ON "PushNotificationLog"("retriedById");

-- CreateIndex
CREATE INDEX "PushNotificationLogDevice_sourceLogDeviceId_idx" ON "PushNotificationLogDevice"("sourceLogDeviceId");

-- AddForeignKey
ALTER TABLE "PushNotificationLog" ADD CONSTRAINT "PushNotificationLog_retriedById_fkey" FOREIGN KEY ("retriedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationLog" ADD CONSTRAINT "PushNotificationLog_originalLogId_fkey" FOREIGN KEY ("originalLogId") REFERENCES "PushNotificationLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationLog" ADD CONSTRAINT "PushNotificationLog_retrySourceLogId_fkey" FOREIGN KEY ("retrySourceLogId") REFERENCES "PushNotificationLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationLogDevice" ADD CONSTRAINT "PushNotificationLogDevice_sourceLogDeviceId_fkey" FOREIGN KEY ("sourceLogDeviceId") REFERENCES "PushNotificationLogDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
