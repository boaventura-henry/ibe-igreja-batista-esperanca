export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  icon?: string;
  badge?: string;
  data?: { url: string };
};

export type PushDevice = {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  isActive: boolean;
  createdAt: string;
  lastSuccessAt: string | null;
  testSentAt: string | null;
  testConfirmedAt: string | null;
  testFailedAt: string | null;
  setupCompletedAt: string | null;
  failureCount: number;
};

export type PushSetupStatus = "UNSUPPORTED" | "PERMISSION_REQUIRED" | "PERMISSION_DENIED" | "SUBSCRIPTION_REQUIRED" | "READY_FOR_TEST" | "TEST_SENT" | "CONFIRMED" | "ERROR";
export type PushSetupStep = "PERMISSION" | "SUBSCRIPTION" | "TEST" | "CONFIRMATION";
export const PUSH_FAILURE_WARNING_THRESHOLD = 3;

export type PushStatus = {
  vapidConfigured: boolean;
  pushEnabled: boolean;
  activeDeviceCount: number;
  devices: PushDevice[];
};
