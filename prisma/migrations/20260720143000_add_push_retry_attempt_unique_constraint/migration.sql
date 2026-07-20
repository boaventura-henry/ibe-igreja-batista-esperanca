-- Prevent duplicate retry attempts for the same push notification chain under concurrent requests.
CREATE UNIQUE INDEX "PushNotificationLog_originalLogId_retryNumber_key" ON "PushNotificationLog"("originalLogId", "retryNumber");
