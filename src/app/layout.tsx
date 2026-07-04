import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "IBE",
  title: {
    default: "IBE - Igreja Batista Esperança",
    template: "%s | IBE"
  },
  description: "Sistema da Igreja Batista Esperança para administração, portal do membro e comunicados.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "IBE",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png" }]
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "IBE",
    "apple-mobile-web-app-status-bar-style": "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#1B382A",
  colorScheme: "light"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          {children}
          <ServiceWorkerRegister />
          <InstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
