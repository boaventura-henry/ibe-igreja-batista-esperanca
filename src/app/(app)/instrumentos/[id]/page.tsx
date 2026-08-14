import { InstrumentDetail } from "@/components/instruments/InstrumentDetail";
export default async function InstrumentPage({params}:{params:Promise<{id:string}>}){return <InstrumentDetail id={(await params).id}/>;}
