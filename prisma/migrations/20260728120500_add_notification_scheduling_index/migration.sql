-- Non-transactional by design: one concurrent index per migration.
CREATE INDEX CONCURRENTLY "Notification_scheduledFor_sentAt_cancelledAt_expiresAt_idx"
ON "Notification"("scheduledFor", "sentAt", "cancelledAt", "expiresAt");
