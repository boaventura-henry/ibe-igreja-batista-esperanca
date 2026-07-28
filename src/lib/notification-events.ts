export const NOTIFICATIONS_CHANGED_EVENT = "ibe:notifications-changed";

export function notifyNotificationStateChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}
