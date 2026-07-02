import { PageHeader } from "@/components/PageHeader";
import { requirePermission } from "@/lib/session";
import { eventService } from "@/services";

export const dynamic = "force-dynamic";

const typeLabels = {
  SERVICE: "Culto",
  CONFERENCE: "Conferencia",
  MEETING: "Reuniao",
  CLASS: "Aula",
  COURSE: "Curso",
  REHEARSAL: "Ensaio",
  VIGIL: "Vigilia",
  RETREAT: "Retiro",
  OUTREACH: "Acao externa",
  OTHER: "Outro"
} as const;

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export default async function PortalEventsPage() {
  await requirePermission("memberPortal.view");
  const events = await eventService.listPublicPublished();

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Eventos"
        description="Acompanhe os eventos publicados pela igreja."
      />

      <div className="grid gap-4">
        {events.length === 0 ? (
          <div className="rounded-md border border-hope-100 bg-white p-6 text-sm font-semibold text-ink-700 shadow-sm">
            Nenhum evento publicado no momento.
          </div>
        ) : null}

        {events.map((event) => (
          <article key={event.id} className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
            {event.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.imageUrl} alt="" className="max-h-72 w-full object-cover" />
            ) : null}
            <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-hope-700">{typeLabels[event.type]}</p>
                <h2 className="mt-1 text-xl font-bold text-ink-900">{event.title}</h2>
                {event.description ? <p className="mt-2 text-sm leading-6 text-ink-600">{event.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-600">
                  {event.ministry ? <span className="rounded-md bg-hope-50 px-2 py-1">{event.ministry.name}</span> : null}
                  {event.location ? <span className="rounded-md bg-hope-50 px-2 py-1">{event.location}</span> : null}
                  {event.address ? <span className="rounded-md bg-hope-50 px-2 py-1">{event.address}</span> : null}
                </div>
              </div>
              <div className="rounded-md bg-gold-100 px-4 py-3 text-sm font-bold text-gold-700">
                <p>{formatDate(event.startDate)}{event.endDate ? ` - ${formatDate(event.endDate)}` : ""}</p>
                <p className="mt-1 text-xs">{[event.startTime, event.endTime].filter(Boolean).join(" - ") || "Horario nao informado"}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
