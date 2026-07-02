import { EventManager } from "@/components/events/EventManager";
import { PageHeader } from "@/components/PageHeader";

export default function EventsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title="Eventos"
        description="Cadastre, publique e acompanhe cultos, conferencias, cursos, ensaios e atividades da igreja."
      />

      <EventManager />
    </>
  );
}
