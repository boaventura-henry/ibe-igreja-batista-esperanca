-- CreateEnum
CREATE TYPE "UserAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateTable
CREATE TABLE "UserAccessRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "cpf" TEXT,
    "birthDate" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "status" "UserAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "possibleMemberId" TEXT,
    "approvedMemberId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccessRequest_username_idx" ON "UserAccessRequest"("username");

-- CreateIndex
CREATE INDEX "UserAccessRequest_email_idx" ON "UserAccessRequest"("email");

-- CreateIndex
CREATE INDEX "UserAccessRequest_cpf_idx" ON "UserAccessRequest"("cpf");

-- CreateIndex
CREATE INDEX "UserAccessRequest_phone_idx" ON "UserAccessRequest"("phone");

-- CreateIndex
CREATE INDEX "UserAccessRequest_status_idx" ON "UserAccessRequest"("status");

-- CreateIndex
CREATE INDEX "UserAccessRequest_possibleMemberId_idx" ON "UserAccessRequest"("possibleMemberId");

-- CreateIndex
CREATE INDEX "UserAccessRequest_approvedMemberId_idx" ON "UserAccessRequest"("approvedMemberId");

-- CreateIndex
CREATE INDEX "UserAccessRequest_approvedById_idx" ON "UserAccessRequest"("approvedById");

-- CreateIndex
CREATE INDEX "UserAccessRequest_rejectedById_idx" ON "UserAccessRequest"("rejectedById");

-- CreateIndex
CREATE INDEX "UserAccessRequest_deletedAt_idx" ON "UserAccessRequest"("deletedAt");

-- CreateIndex
CREATE INDEX "UserAccessRequest_username_status_deletedAt_idx" ON "UserAccessRequest"("username", "status", "deletedAt");

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_possibleMemberId_fkey" FOREIGN KEY ("possibleMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_approvedMemberId_fkey" FOREIGN KEY ("approvedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
