import { VisitorDetail } from "@/components/visitors/VisitorDetail";
import { requirePermission } from "@/lib/session";

export default async function VisitorPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("visitor.view");
  return <VisitorDetail id={(await params).id} />;
}
