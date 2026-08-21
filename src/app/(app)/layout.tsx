import { AppShell } from "@/components/AppShell";
import { requireCurrentUser } from "@/lib/session";

export default async function InternalLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireCurrentUser();

  return <AppShell permissionCodes={user.permissionCodes}>{children}</AppShell>;
}
