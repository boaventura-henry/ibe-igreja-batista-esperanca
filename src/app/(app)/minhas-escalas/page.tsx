import { PageHeader } from "@/components/PageHeader";
import { MyScheduleManager } from "@/components/my-schedules/MyScheduleManager";
import { requirePermission } from "@/lib/session";
import { myScheduleService } from "@/services";

export const dynamic = "force-dynamic";

export default async function MySchedulesPage() {
  const user = await requirePermission("mySchedule.view");
  const data = await myScheduleService.list(user);

  return (
    <>
      <PageHeader
        eyebrow="Minhas Escalas"
        title="Minhas Escalas"
        description="Acompanhe suas participacoes e confirme sua presenca nas escalas."
      />

      <MyScheduleManager initialData={data} />
    </>
  );
}
