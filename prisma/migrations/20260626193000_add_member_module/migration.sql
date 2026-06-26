-- CreateEnum
CREATE TYPE "MemberSex" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'NOT_INFORMED');

-- AlterEnum
ALTER TYPE "MemberStatus" ADD VALUE 'TRANSFERRED';
ALTER TYPE "MemberStatus" ADD VALUE 'DECEASED';

-- AlterTable
ALTER TABLE "Member" DROP COLUMN "address",
ADD COLUMN     "baptismDate" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "district" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "mobilePhone" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "sex" "MemberSex" NOT NULL DEFAULT 'NOT_INFORMED',
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "whatsapp" TEXT,
ADD COLUMN     "zipCode" TEXT,
ALTER COLUMN "joinedAt" DROP NOT NULL,
ALTER COLUMN "joinedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_cpf_key" ON "Member"("cpf");

-- CreateIndex
CREATE INDEX "Member_name_idx" ON "Member"("name");

-- CreateIndex
CREATE INDEX "Member_cpf_idx" ON "Member"("cpf");

-- CreateIndex
CREATE INDEX "Member_city_idx" ON "Member"("city");

-- CreateIndex
CREATE INDEX "Member_status_idx" ON "Member"("status");

-- CreateIndex
CREATE INDEX "Member_deletedAt_idx" ON "Member"("deletedAt");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
