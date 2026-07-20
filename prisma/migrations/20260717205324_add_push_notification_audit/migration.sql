-- CreateEnum
CREATE TYPE "PushNotificationTargetType" AS ENUM ('USER', 'ROLE', 'ALL', 'DEVICE');

-- CreateEnum
CREATE TYPE "PushNotificationLogStatus" AS ENUM ('PENDING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PushNotificationLogDeviceStatus" AS ENUM ('SUCCESS', 'FAILED', 'EXPIRED', 'REMOVED');

-- CreateTable
CREATE TABLE "PushNotificationLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetType" "PushNotificationTargetType" NOT NULL,
    "targetDescription" TEXT,
    "devicesFound" INTEGER NOT NULL DEFAULT 0,
    "devicesAttempted" INTEGER NOT NULL DEFAULT 0,
    "devicesSucceeded" INTEGER NOT NULL DEFAULT 0,
    "devicesFailed" INTEGER NOT NULL DEFAULT 0,
    "status" "PushNotificationLogStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "payloadJson" JSONB,

    CONSTRAINT "PushNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushNotificationLogDevice" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "deviceId" TEXT,
    "userId" TEXT,
    "memberId" TEXT,
    "deviceName" TEXT,
    "platform" TEXT,
    "browser" TEXT,
    "endpointHash" TEXT NOT NULL,
    "status" "PushNotificationLogDeviceStatus" NOT NULL,
    "httpStatus" INTEGER,
    "pushService" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "PushNotificationLogDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PushNotificationLog_createdAt_idx" ON "PushNotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "PushNotificationLog_createdById_idx" ON "PushNotificationLog"("createdById");

-- CreateIndex
CREATE INDEX "PushNotificationLog_targetType_idx" ON "PushNotificationLog"("targetType");

-- CreateIndex
CREATE INDEX "PushNotificationLog_status_idx" ON "PushNotificationLog"("status");

-- CreateIndex
CREATE INDEX "PushNotificationLog_startedAt_idx" ON "PushNotificationLog"("startedAt");

-- CreateIndex
CREATE INDEX "PushNotificationLog_finishedAt_idx" ON "PushNotificationLog"("finishedAt");

-- CreateIndex
CREATE INDEX "PushNotificationLogDevice_logId_idx" ON "PushNotificationLogDevice"("logId");

-- CreateIndex
CREATE INDEX "PushNotificationLogDevice_deviceId_idx" ON "PushNotificationLogDevice"("deviceId");

-- CreateIndex
CREATE INDEX "PushNotificationLogDevice_userId_idx" ON "PushNotificationLogDevice"("userId");

-- CreateIndex
CREATE INDEX "PushNotificationLogDevice_memberId_idx" ON "PushNotificationLogDevice"("memberId");

-- CreateIndex
CREATE INDEX "PushNotificationLogDevice_endpointHash_idx" ON "PushNotificationLogDevice"("endpointHash");

-- CreateIndex
CREATE INDEX "PushNotificationLogDevice_status_idx" ON "PushNotificationLogDevice"("status");

-- CreateIndex
CREATE INDEX "PushNotificationLogDevice_sentAt_idx" ON "PushNotificationLogDevice"("sentAt");

-- AddForeignKey
ALTER TABLE "PushNotificationLog" ADD CONSTRAINT "PushNotificationLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationLogDevice" ADD CONSTRAINT "PushNotificationLogDevice_logId_fkey" FOREIGN KEY ("logId") REFERENCES "PushNotificationLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationLogDevice" ADD CONSTRAINT "PushNotificationLogDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationLogDevice" ADD CONSTRAINT "PushNotificationLogDevice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
