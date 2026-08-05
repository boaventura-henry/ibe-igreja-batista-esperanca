WITH boundary AS (
  SELECT
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date::timestamp
      AS "todayDate"
)
UPDATE "Event"
SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
FROM boundary
WHERE "deletedAt" IS NULL
  AND "status" IN ('DRAFT', 'PUBLISHED')
  AND COALESCE("endDate", "startDate") < boundary."todayDate";

WITH boundary AS (
  SELECT (
    ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date::timestamp
      AT TIME ZONE 'America/Sao_Paulo')
      AT TIME ZONE 'UTC'
  ) AS "todayStartUtc"
)
UPDATE "Announcement"
SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
FROM boundary
WHERE "deletedAt" IS NULL
  AND "status" IN ('DRAFT', 'PUBLISHED')
  AND "expiresAt" IS NOT NULL
  AND "expiresAt" < boundary."todayStartUtc";

WITH boundary AS (
  SELECT
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date::timestamp
      AS "todayDate"
)
UPDATE "Schedule"
SET "status" = 'COMPLETED', "updatedAt" = CURRENT_TIMESTAMP
FROM boundary
WHERE "deletedAt" IS NULL
  AND "status" = 'PUBLISHED'
  AND "date" < boundary."todayDate";
