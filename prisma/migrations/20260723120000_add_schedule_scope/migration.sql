-- CreateEnum
CREATE TYPE "ScheduleScope" AS ENUM ('ALL', 'MEMBER_MINISTRIES');

-- Preserve the existing production behavior for every current access role.
ALTER TABLE "AccessRole"
ADD COLUMN "scheduleScope" "ScheduleScope" NOT NULL DEFAULT 'ALL';

-- New access roles are restricted by default.
ALTER TABLE "AccessRole"
ALTER COLUMN "scheduleScope" SET DEFAULT 'MEMBER_MINISTRIES';
