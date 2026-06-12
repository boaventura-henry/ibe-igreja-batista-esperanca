import { PageHeader } from "@/components/PageHeader";

const events = [
  { title: "Culto de Celebracao", when: "Domingo, 19h", place: "Templo principal" },
  { title: "Reuniao de Lideranca", when: "Terca, 20h", place: "Sala pastoral" },
  { title: "Encontro de Jovens", when: "Sabado, 18h", place: "Sala multiuso" }
];

export default function EventsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title="Eventos"
        description="Planeje cultos, reunioes e atividades ministeriais com uma estrutura pronta para persistencia no banco."
        action={<button className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo evento</button>}
      />

      <div className="grid gap-4">
        {events.map((event) => (
          <article
            key={event.title}
            className="flex flex-col gap-3 rounded-md border border-hope-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="text-lg font-bold text-ink-900">{event.title}</h2>
              <p className="text-sm text-ink-500">{event.place}</p>
            </div>
            <span className="rounded-md bg-gold-100 px-3 py-2 text-sm font-bold text-gold-600">
              {event.when}
            </span>
          </article>
        ))}
      </div>
    </>
  );
}
