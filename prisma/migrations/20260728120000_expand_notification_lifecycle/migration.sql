-- Atomic expand phase. Nullable columns avoid a table rewrite.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '2min';

ALTER TABLE "Notification"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- Enforced for new writes without scanning or rejecting legacy Notification rows.
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE
NOT VALID;

COMMIT;
