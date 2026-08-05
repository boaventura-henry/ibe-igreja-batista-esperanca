import { lifecycleService } from "@/services/lifecycle.service";
import { scheduleNotificationService } from "@/services/schedule-notification.service";

export const scheduledJobsService = {
  async run(now = new Date()) {
    const jobs = await Promise.allSettled([
      scheduleNotificationService.processPendingReminders(now),
      lifecycleService.processExpiredSchedules(now),
      lifecycleService.processExpiredEvents(now),
      lifecycleService.processExpiredAnnouncements(now)
    ]);
    const failure = jobs.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failure) throw failure.reason;

    const [reminders, schedules, events, announcements] = jobs.map(
      (result) => (result as PromiseFulfilledResult<unknown>).value
    );
    return {
      ...(reminders as Awaited<ReturnType<typeof scheduleNotificationService.processPendingReminders>>),
      lifecycle: { schedules, events, announcements }
    };
  }
};
