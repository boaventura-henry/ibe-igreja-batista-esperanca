-- Non-transactional by design: one concurrent index per migration.
CREATE INDEX CONCURRENTLY "Notification_userId_hiddenAt_createdAt_idx"
ON "Notification"("userId", "hiddenAt", "createdAt");
