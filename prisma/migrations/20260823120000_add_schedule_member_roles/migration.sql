ALTER TYPE "ScheduleMemberRole" ADD VALUE 'MINISTER' BEFORE 'LEADER';
ALTER TYPE "ScheduleMemberRole" ADD VALUE 'BACKING' AFTER 'VOCAL';

CREATE TABLE "ScheduleMemberRoleAssignment" (
    "id" TEXT NOT NULL,
    "scheduleMemberId" TEXT NOT NULL,
    "role" "ScheduleMemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleMemberRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleMemberRoleAssignment_scheduleMemberId_role_key"
ON "ScheduleMemberRoleAssignment"("scheduleMemberId", "role");

CREATE INDEX "ScheduleMemberRoleAssignment_role_idx"
ON "ScheduleMemberRoleAssignment"("role");

ALTER TABLE "ScheduleMemberRoleAssignment"
ADD CONSTRAINT "ScheduleMemberRoleAssignment_scheduleMemberId_fkey"
FOREIGN KEY ("scheduleMemberId") REFERENCES "ScheduleMember"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ScheduleMemberRoleAssignment" (
    "id",
    "scheduleMemberId",
    "role",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_' || md5("id"),
    "id",
    "role",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "ScheduleMember";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "ScheduleMember" sm
        LEFT JOIN "ScheduleMemberRoleAssignment" smr
          ON smr."scheduleMemberId" = sm."id"
        WHERE smr."id" IS NULL
    ) THEN
        RAISE EXCEPTION 'ScheduleMember role backfill left participants without roles';
    END IF;
END $$;
