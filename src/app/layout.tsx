import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IBE - Igreja Batista Esperanca",
  description: "Sistema administrativo da Igreja Batista Esperanca"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
