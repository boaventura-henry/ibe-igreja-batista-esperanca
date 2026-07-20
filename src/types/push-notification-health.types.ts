export type PushNotificationHealthMetric = {
  label: string;
  value: string;
  detail: string;
  severity?: "neutral" | "success" | "warning" | "danger";
};

export type PushNotificationDistributionItem = {
  label: string;
  count: number;
};

export type PushNotificationOperationalAlert = {
  code: string;
  title: string;
  message: string;
  severity: "warning" | "danger";
};

export type PushNotificationDeviceHealth = {
  id: string;
  user: { id: string; name: string; username: string };
  member: { id: string; name: string; nickname: string | null; displayName: string } | null;
  deviceName: string | null;
  platform: string | null;
  browser: string | null;
  endpointHashShort: string;
  isActive: boolean;
  firstRegisteredAt: string;
  lastRegisteredAt: string;
  lastNotificationAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  receivedCount: number;
  failedCount: number;
  retryCount: number;
  subscriptionCount: number;
  expiredCount: number;
  removedAt: string | null;
  daysSinceLastRegistration: number;
};

export type PushNotificationDeviceHealthResult = {
  devices: PushNotificationDeviceHealth[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type PushNotificationHealthData = {
  thresholdDays: number;
  metrics: PushNotificationHealthMetric[];
  alerts: PushNotificationOperationalAlert[];
  platformDistribution: PushNotificationDistributionItem[];
  browserDistribution: PushNotificationDistributionItem[];
  devicesPerUser: PushNotificationDistributionItem[];
  expiredDevices: PushNotificationDeviceHealth[];
};
