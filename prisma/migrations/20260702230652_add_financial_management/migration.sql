-- CreateEnum
CREATE TYPE "FinancialEntryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinancialPaymentMethod" AS ENUM ('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialEntryStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FinancialEntryOrigin" AS ENUM ('MANUAL', 'PIX', 'EVENT', 'OTHER');

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FinancialEntryType" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "showInMemberPortal" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" INTEGER NOT NULL,
    "type" "FinancialEntryType" NOT NULL,
    "memberId" TEXT,
    "categoryId" TEXT NOT NULL,
    "eventId" TEXT,
    "ministryId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "FinancialPaymentMethod" NOT NULL DEFAULT 'OTHER',
    "status" "FinancialEntryStatus" NOT NULL DEFAULT 'CONFIRMED',
    "origin" "FinancialEntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "launchDate" TIMESTAMP(3) NOT NULL,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "observation" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialClosing" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(12,2) NOT NULL,
    "closingBalance" DECIMAL(12,2) NOT NULL,
    "openedById" TEXT,
    "closedById" TEXT,
    "observation" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialCategory_name_idx" ON "FinancialCategory"("name");

-- CreateIndex
CREATE INDEX "FinancialCategory_type_idx" ON "FinancialCategory"("type");

-- CreateIndex
CREATE INDEX "FinancialCategory_displayOrder_idx" ON "FinancialCategory"("displayOrder");

-- CreateIndex
CREATE INDEX "FinancialCategory_isActive_idx" ON "FinancialCategory"("isActive");

-- CreateIndex
CREATE INDEX "FinancialCategory_showInMemberPortal_idx" ON "FinancialCategory"("showInMemberPortal");

-- CreateIndex
CREATE INDEX "FinancialCategory_deletedAt_idx" ON "FinancialCategory"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_name_type_key" ON "FinancialCategory"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_entryNumber_key" ON "FinancialEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "FinancialEntry_entryNumber_idx" ON "FinancialEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "FinancialEntry_type_idx" ON "FinancialEntry"("type");

-- CreateIndex
CREATE INDEX "FinancialEntry_memberId_idx" ON "FinancialEntry"("memberId");

-- CreateIndex
CREATE INDEX "FinancialEntry_categoryId_idx" ON "FinancialEntry"("categoryId");

-- CreateIndex
CREATE INDEX "FinancialEntry_eventId_idx" ON "FinancialEntry"("eventId");

-- CreateIndex
CREATE INDEX "FinancialEntry_ministryId_idx" ON "FinancialEntry"("ministryId");

-- CreateIndex
CREATE INDEX "FinancialEntry_paymentMethod_idx" ON "FinancialEntry"("paymentMethod");

-- CreateIndex
CREATE INDEX "FinancialEntry_status_idx" ON "FinancialEntry"("status");

-- CreateIndex
CREATE INDEX "FinancialEntry_origin_idx" ON "FinancialEntry"("origin");

-- CreateIndex
CREATE INDEX "FinancialEntry_launchDate_idx" ON "FinancialEntry"("launchDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_referenceDate_idx" ON "FinancialEntry"("referenceDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_deletedAt_idx" ON "FinancialEntry"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialClosing_date_key" ON "FinancialClosing"("date");

-- CreateIndex
CREATE INDEX "FinancialClosing_date_idx" ON "FinancialClosing"("date");

-- CreateIndex
CREATE INDEX "FinancialClosing_deletedAt_idx" ON "FinancialClosing"("deletedAt");

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialClosing" ADD CONSTRAINT "FinancialClosing_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialClosing" ADD CONSTRAINT "FinancialClosing_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
