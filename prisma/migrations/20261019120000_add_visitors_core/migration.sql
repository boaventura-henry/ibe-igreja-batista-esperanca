-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CONVERTED');

-- CreateEnum
CREATE TYPE "VisitorPrivacyChannel" AS ENUM ('PUBLIC_VISIT_FORM');

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "status" "VisitorStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorVisit" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorPrivacyRecord" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL,
    "channel" "VisitorPrivacyChannel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorPrivacyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_phone_birthDate_key" ON "Visitor"("phone", "birthDate");

-- CreateIndex
CREATE INDEX "Visitor_name_idx" ON "Visitor"("name");

-- CreateIndex
CREATE INDEX "Visitor_birthDate_idx" ON "Visitor"("birthDate");

-- CreateIndex
CREATE INDEX "Visitor_status_deletedAt_idx" ON "Visitor"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorVisit_visitorId_visitDate_key" ON "VisitorVisit"("visitorId", "visitDate");

-- CreateIndex
CREATE INDEX "VisitorVisit_visitDate_idx" ON "VisitorVisit"("visitDate");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorPrivacyRecord_visitorId_noticeVersion_channel_key" ON "VisitorPrivacyRecord"("visitorId", "noticeVersion", "channel");

-- CreateIndex
CREATE INDEX "VisitorPrivacyRecord_visitorId_acknowledgedAt_idx" ON "VisitorPrivacyRecord"("visitorId", "acknowledgedAt");

-- CreateIndex
CREATE INDEX "VisitorPrivacyRecord_noticeVersion_idx" ON "VisitorPrivacyRecord"("noticeVersion");

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorVisit" ADD CONSTRAINT "VisitorVisit_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorPrivacyRecord" ADD CONSTRAINT "VisitorPrivacyRecord_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
