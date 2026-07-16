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
};

export type PushStatus = {
  vapidConfigured: boolean;
  pushEnabled: boolean;
  activeDeviceCount: number;
  devices: PushDevice[];
};
