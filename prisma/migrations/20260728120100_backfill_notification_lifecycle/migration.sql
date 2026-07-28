-- Atomic, preservation-only backfill. Existing migrated values always win.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

UPDATE "Notification"
SET "hiddenAt" = "deletedAt"
WHERE "deletedAt" IS NOT NULL
  AND "sentAt" IS NOT NULL
  AND "hiddenAt" IS NULL;

UPDATE "Notification"
SET "cancelledAt" = "deletedAt"
WHERE "deletedAt" IS NOT NULL
  AND "sentAt" IS NULL
  AND "cancelledAt" IS NULL;

COMMIT;
