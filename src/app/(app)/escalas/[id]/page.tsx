import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ScheduleDetailManager } from "@/components/schedules/ScheduleDetailManager";
import { AppError } from "@/lib/errors";
import { scheduleService } from "@/services";

export const dynamic = "force-dynamic";

type ScheduleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ScheduleDetailPage({ params }: ScheduleDetailPageProps) {
  const { id } = await params;

  try {
    const schedule = await scheduleService.getById(id);

    return (
      <>
        <PageHeader
          eyebrow="Detalhe da escala"
          title={schedule.title}
          description="Membros escalados, funcoes, confirmacoes e substituicoes."
          action={
            <Link
              href="/escalas"
              className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-hope-50"
            >
              Voltar
            </Link>
          }
        />

        <ScheduleDetailManager initialSchedule={schedule} />
      </>
    );
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }
}
