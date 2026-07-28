-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCHEDULE_PUBLISHED', 'SCHEDULE_REMINDER', 'NOTICE_CREATED', 'EVENT_CREATED', 'BIRTHDAY');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "actionUrl" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "deduplicationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderHoursBefore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InAppNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_deletedAt_createdAt_idx" ON "Notification"("userId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_deletedAt_idx" ON "Notification"("userId", "readAt", "deletedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_type_deletedAt_idx" ON "Notification"("userId", "type", "deletedAt");

-- CreateIndex
CREATE INDEX "Notification_scheduledFor_sentAt_deletedAt_idx" ON "Notification"("scheduledFor", "sentAt", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_deduplicationKey_key" ON "Notification"("userId", "deduplicationKey");

-- CreateIndex
CREATE INDEX "InAppNotificationPreference_userId_idx" ON "InAppNotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InAppNotificationPreference_userId_type_key" ON "InAppNotificationPreference"("userId", "type");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotificationPreference" ADD CONSTRAINT "InAppNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
