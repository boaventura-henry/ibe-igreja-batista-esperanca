import { InstrumentDetail } from "@/components/instruments/InstrumentDetail";
import { requirePermission } from "@/lib/session";
export default async function InstrumentPage({params}:{params:Promise<{id:string}>}){await requirePermission("instrument.view");return <InstrumentDetail id={(await params).id}/>;}
