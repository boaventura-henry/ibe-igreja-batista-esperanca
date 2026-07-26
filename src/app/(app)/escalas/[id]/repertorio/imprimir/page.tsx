import { PrintButton } from "@/components/schedules/PrintButton";
import { requireScheduleAccess } from "@/lib/schedule-authorization";
import { scheduleService, scheduleSongService } from "@/services";

export const dynamic = "force-dynamic";

export default async function PrintRepertoirePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const authorization = await requireScheduleAccess("schedule.view");
  const id = (await params).id;
  const [schedule, repertoire] = await Promise.all([
    scheduleService.getById(id, authorization),
    scheduleSongService.list(id, authorization)
  ]);

  return (
    <main className="mx-auto max-w-3xl p-8 text-ink-900 print:max-w-none print:p-0">
      <div className="mb-6 flex items-start justify-between print:mb-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-ink-500">
            Igreja Batista Esperanca
          </p>
          <h1 className="text-2xl font-bold">{schedule.title}</h1>
          <p>
            {schedule.ministry.name} |{" "}
            {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
              new Date(schedule.date)
            )}{" "}
            |{" "}
            {[schedule.startTime, schedule.endTime].filter(Boolean).join(" - ") ||
              "Horario nao informado"}
          </p>
          <p>{schedule.location || "Local nao informado"}</p>
        </div>
        <PrintButton />
      </div>

      <ol className="grid gap-3">
        {repertoire.songs.map((item) => (
          <li key={item.id} className="border-b border-ink-200 pb-3">
            <p className="font-bold">
              {item.position}. {item.song.title}
              {item.performanceKey ? ` - ${item.performanceKey}` : ""}
            </p>
            <p className="text-sm">
              {item.song.artist || "Artista nao informado"}
              {item.leadMember ? ` | Ministro: ${item.leadMember.name}` : ""}
            </p>
            {item.notes ? <p className="text-sm">{item.notes}</p> : null}
          </li>
        ))}
      </ol>

      <style>
        {"@media print { button { display: none } body { background: white } }"}
      </style>
    </main>
  );
}
