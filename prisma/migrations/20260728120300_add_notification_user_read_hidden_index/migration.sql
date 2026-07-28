-- Non-transactional by design: one concurrent index per migration.
CREATE INDEX CONCURRENTLY "Notification_userId_readAt_hiddenAt_idx"
ON "Notification"("userId", "readAt", "hiddenAt");
