export type PushLogStatusFilter = "" | "PENDING" | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";

export type PushNotificationAttemptSummary = {
  id: string;
  createdAt: string;
  retryNumber: number;
  status: string;
  devicesAttempted: number;
  devicesSucceeded: number;
  devicesFailed: number;
  devicesSkipped: number;
  durationMs: number | null;
};

export type PushNotificationLogSummary = PushNotificationAttemptSummary & {
  title: string;
  body: string;
  targetType: string;
  targetDescription: string | null;
  devicesFound: number;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  createdBy: { id: string; name: string; username: string } | null;
  retriedBy: { id: string; name: string; username: string } | null;
  originalLog: PushNotificationAttemptSummary | null;
  retrySourceLog: PushNotificationAttemptSummary | null;
};

export type PushNotificationLogDeviceSummary = {
  id: string;
  deviceId: string | null;
  sourceLogDeviceId: string | null;
  attemptNumber: number;
  user: { id: string; name: string; username: string } | null;
  member: { id: string; name: string; nickname: string | null; displayName: string } | null;
  deviceName: string | null;
  platform: string | null;
  browser: string | null;
  endpointHashShort: string;
  status: string;
  skipReason: string | null;
  httpStatus: number | null;
  pushService: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  lastCheckedAt: string | null;
  sourceLogDevice: { id: string; status: string; sentAt: string | null } | null;
};

export type PushNotificationChainSummary = {
  totalUniqueDevices: number;
  succeeded: number;
  stillFailed: number;
  expired: number;
  removed: number;
  skipped: number;
  recoveredAfterRetry: number;
  initialSuccessRate: number;
  finalSuccessRate: number;
};

export type PushNotificationRetryEligibility = {
  canRetry: boolean;
  reason: string | null;
  failed: number;
  eligible: number;
  skipped: number;
  totals: Record<string, number>;
};

export type PushNotificationRetryResult = {
  logId: string;
  retryNumber: number;
  status: string;
  eligible: number;
  attempted: number;
  succeeded: number;
  failed: number;
  expired: number;
  removed: number;
  skipped: number;
  idempotent: boolean;
};

export type PushNotificationLogListResult = {
  logs: PushNotificationLogSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type PushNotificationLogDetailResult = PushNotificationLogSummary & {
  devices: PushNotificationLogDeviceSummary[];
  retryAttempts: PushNotificationAttemptSummary[];
  retrySourceAttempts: PushNotificationAttemptSummary[];
  chainSummary: PushNotificationChainSummary;
  retryEligibility: PushNotificationRetryEligibility;
};
