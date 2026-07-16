-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN     "setupCompletedAt" TIMESTAMP(3),
ADD COLUMN     "testConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "testFailedAt" TIMESTAMP(3),
ADD COLUMN     "testSentAt" TIMESTAMP(3);
