-- AlterTable
ALTER TABLE "UserAccessRequest" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserAccessRequest" ADD COLUMN "rg" TEXT;

-- CreateIndex
CREATE INDEX "UserAccessRequest_rg_idx" ON "UserAccessRequest"("rg");
