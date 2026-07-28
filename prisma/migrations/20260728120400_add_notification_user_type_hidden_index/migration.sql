-- Non-transactional by design: one concurrent index per migration.
CREATE INDEX CONCURRENTLY "Notification_userId_type_hiddenAt_idx"
ON "Notification"("userId", "type", "hiddenAt");
