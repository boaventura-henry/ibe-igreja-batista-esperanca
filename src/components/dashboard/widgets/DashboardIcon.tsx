import type { DashboardWidgetIconKey } from "@/config/dashboard-widget-enums";

const paths: Record<DashboardWidgetIconKey, string> = {
  USERS: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  CAKE: "M4 11h16v10H4zM8 11V7M12 11V7M16 11V7M8 4h.01M12 4h.01M16 4h.01M4 16c2 1 3 1 4 0 2 1 3 1 4 0 2 1 3 1 4 0 2 1 3 1 4 0",
  CALENDAR: "M3 5h18v16H3zM16 3v4M8 3v4M3 10h18",
  MUSIC: "M9 18V5l12-2v13M9 9l12-2M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  WALLET: "M3 6h18v14H3zM3 9h18M16 13h5v4h-5z",
  TRENDING_UP: "M3 17l6-6 4 4 8-8M15 7h6v6",
  HAND_COINS: "M3 18h4l3 3h7l4-4M7 18V9l3-3 4 4M12 14h5a2 2 0 0 1 0 4h-6M17 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  MEGAPHONE: "M3 11v4h4l9 4V7l-9 4zM7 15l2 6M18 9a4 4 0 0 1 0 4",
  BELL: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  HEART_PULSE: "M3 12h4l2-4 4 8 2-4h6M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8",
  SERVER: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
  SHIELD: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
};

export function DashboardIcon({ iconKey, className = "h-5 w-5" }: { iconKey: DashboardWidgetIconKey; className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={paths[iconKey]} /></svg>;
}
