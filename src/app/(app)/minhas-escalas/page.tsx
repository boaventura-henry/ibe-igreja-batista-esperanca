import { PageHeader } from "@/components/PageHeader";
import { MyScheduleManager } from "@/components/my-schedules/MyScheduleManager";
import { MemberLinkRequired } from "@/components/portal/MemberLinkRequired";
import { loadMySchedulesPageData } from "@/lib/my-schedules-page";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MySchedulesPage() {
  const user = await requirePermission("mySchedule.view");
  const result = await loadMySchedulesPageData(user);

  return (
    <>
      <PageHeader
        eyebrow="Minhas Escalas"
        title="Minhas Escalas"
        description="Acompanhe suas participacoes e confirme sua presenca nas escalas."
      />

      {result.kind === "member-link-required" ? (
        <MemberLinkRequired message="Seu usuario esta autenticado, mas ainda nao esta vinculado a um cadastro de membro. Entre em contato com a administracao para acessar suas escalas." />
      ) : (
        <MyScheduleManager initialData={result.data} />
      )}
    </>
  );
}
