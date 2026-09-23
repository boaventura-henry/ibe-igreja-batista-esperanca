CREATE TABLE "MinistryFinancialAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryFinancialAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MinistryFinancialAccess_userId_ministryId_key" ON "MinistryFinancialAccess"("userId", "ministryId");
CREATE INDEX "MinistryFinancialAccess_userId_idx" ON "MinistryFinancialAccess"("userId");
CREATE INDEX "MinistryFinancialAccess_ministryId_idx" ON "MinistryFinancialAccess"("ministryId");
CREATE INDEX "MinistryFinancialAccess_createdById_idx" ON "MinistryFinancialAccess"("createdById");

ALTER TABLE "MinistryFinancialAccess" ADD CONSTRAINT "MinistryFinancialAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MinistryFinancialAccess" ADD CONSTRAINT "MinistryFinancialAccess_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MinistryFinancialAccess" ADD CONSTRAINT "MinistryFinancialAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
