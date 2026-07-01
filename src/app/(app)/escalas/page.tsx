import { PageHeader } from "@/components/PageHeader";
import { ScheduleManager } from "@/components/schedules/ScheduleManager";

export default function SchedulesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Escalas"
        title="Gestao de Escalas"
        description="Organize ministerios, datas, funcoes e confirmacoes de participacao."
      />

      <ScheduleManager />
    </>
  );
}
