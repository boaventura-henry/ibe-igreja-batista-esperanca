import { PageHeader } from "@/components/PageHeader";
import { MyScheduleManager } from "@/components/my-schedules/MyScheduleManager";
import { MemberLinkRequired } from "@/components/portal/MemberLinkRequired";
import { requirePermission } from "@/lib/session";
import { myScheduleService } from "@/services";

export const dynamic = "force-dynamic";

export default async function PortalMySchedulesPage() {
  const user = await requirePermission("memberPortal.view");

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Minhas Escalas"
        description="Confirme sua presenca ou informe quando nao puder participar."
      />

      {!user.memberId ? <MemberLinkRequired /> : <MyScheduleManager initialData={await myScheduleService.list(user)} />}
    </>
  );
}
