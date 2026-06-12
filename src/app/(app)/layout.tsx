import { AppShell } from "@/components/AppShell";

export default function InternalLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
