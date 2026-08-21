import { PageHeader } from "@/components/PageHeader";
import { InstrumentManager } from "@/components/instruments/InstrumentManager";
import { requirePermission } from "@/lib/session";
export default async function InstrumentsPage(){await requirePermission("instrument.view");return <><PageHeader eyebrow="Instrumentos" title="Instrumentos" description="Gerencie o patrimonio instrumental da igreja e seu historico." /><InstrumentManager /></>;}
