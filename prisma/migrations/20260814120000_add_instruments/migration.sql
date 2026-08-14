-- CreateEnum
CREATE TYPE "InstrumentStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InstrumentHistoryType" AS ENUM ('MAINTENANCE', 'REPLACEMENT', 'OTHER');

-- CreateTable
CREATE TABLE "InstrumentCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstrumentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "assetNumber" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionValue" DECIMAL(12,2),
    "status" "InstrumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "ministryId" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentHistory" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "type" "InstrumentHistoryType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DECIMAL(12,2),
    "serviceProvider" TEXT,
    "notes" TEXT,
    "relatedInstrumentId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstrumentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentCategory_name_key" ON "InstrumentCategory"("name");

-- CreateIndex
CREATE INDEX "InstrumentCategory_name_idx" ON "InstrumentCategory"("name");

-- CreateIndex
CREATE INDEX "InstrumentCategory_isActive_deletedAt_idx" ON "InstrumentCategory"("isActive", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_serialNumber_key" ON "Instrument"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_assetNumber_key" ON "Instrument"("assetNumber");

-- CreateIndex
CREATE INDEX "Instrument_name_idx" ON "Instrument"("name");

-- CreateIndex
CREATE INDEX "Instrument_categoryId_idx" ON "Instrument"("categoryId");

-- CreateIndex
CREATE INDEX "Instrument_status_idx" ON "Instrument"("status");

-- CreateIndex
CREATE INDEX "Instrument_ministryId_idx" ON "Instrument"("ministryId");

-- CreateIndex
CREATE INDEX "Instrument_deletedAt_idx" ON "Instrument"("deletedAt");

-- CreateIndex
CREATE INDEX "InstrumentHistory_instrumentId_occurredAt_idx" ON "InstrumentHistory"("instrumentId", "occurredAt");

-- CreateIndex
CREATE INDEX "InstrumentHistory_type_idx" ON "InstrumentHistory"("type");

-- CreateIndex
CREATE INDEX "InstrumentHistory_relatedInstrumentId_idx" ON "InstrumentHistory"("relatedInstrumentId");

-- AddForeignKey
ALTER TABLE "InstrumentCategory" ADD CONSTRAINT "InstrumentCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentCategory" ADD CONSTRAINT "InstrumentCategory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InstrumentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentHistory" ADD CONSTRAINT "InstrumentHistory_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentHistory" ADD CONSTRAINT "InstrumentHistory_relatedInstrumentId_fkey" FOREIGN KEY ("relatedInstrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentHistory" ADD CONSTRAINT "InstrumentHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentHistory" ADD CONSTRAINT "InstrumentHistory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
