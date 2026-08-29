-- DropIndex
DROP INDEX "ScheduleMember_role_idx";

-- AlterTable
ALTER TABLE "ScheduleMember" DROP COLUMN "role";
