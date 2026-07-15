import { Suspense } from "react";
import { HelpCenter } from "@/components/help/HelpCenter";

export default function HelpPage() {
  return <Suspense fallback={<main className="min-h-screen p-8 text-sm font-semibold">Carregando ajuda...</main>}><HelpCenter /></Suspense>;
}
