-- CreateEnum
CREATE TYPE "PasswordResetRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'CANCELED');

-- CreateTable
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "normalizedIdentifier" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "cpf" TEXT,
    "status" "PasswordResetRequestStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "processedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetRequest_identifier_idx" ON "PasswordResetRequest"("identifier");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_normalizedIdentifier_idx" ON "PasswordResetRequest"("normalizedIdentifier");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_status_idx" ON "PasswordResetRequest"("status");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_userId_idx" ON "PasswordResetRequest"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_processedById_idx" ON "PasswordResetRequest"("processedById");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_requestedAt_idx" ON "PasswordResetRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_processedAt_idx" ON "PasswordResetRequest"("processedAt");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_deletedAt_idx" ON "PasswordResetRequest"("deletedAt");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_normalizedIdentifier_status_deletedAt_idx" ON "PasswordResetRequest"("normalizedIdentifier", "status", "deletedAt");

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_processing_state_check" CHECK (
    (
        "status" IN ('PENDING', 'CANCELED')
        AND "processedAt" IS NULL
        AND "processedById" IS NULL
    )
    OR
    (
        "status" IN ('COMPLETED', 'REJECTED')
        AND "processedAt" IS NOT NULL
        AND "processedById" IS NOT NULL
    )
);

-- AddCheckConstraint
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_rejection_reason_check" CHECK (
    (
        "status" = 'REJECTED'
        AND "rejectionReason" IS NOT NULL
        AND length(trim("rejectionReason")) > 0
    )
    OR "status" <> 'REJECTED'
);
