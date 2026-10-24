import type { Metadata } from "next";
import { PublicVisitorCheckInForm } from "@/components/visitors/PublicVisitorCheckInForm";
import { visitorPrivacyNotice } from "@/config/visitor-privacy";

export const metadata: Metadata = {
  title: "Visite-nos | Igreja Batista Esperança",
  description: "Informações para visitar a Igreja Batista Esperança."
};

export default function VisitUsPage() {
  return (
    <main className="min-h-screen bg-hope-50 px-4 py-8 text-ink-900 sm:py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <section className="rounded-md border border-hope-100 bg-white p-6 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-hope-700">IBE</p>
          <h1 className="mt-3 text-3xl font-bold">Igreja Batista Esperança</h1>
          <div className="mt-7 space-y-6 text-sm leading-6 text-ink-700">
            <section>
              <h2 className="font-bold text-ink-900">Endereço</h2>
              <address className="mt-1 not-italic">Av. Ibirapuera, 733<br />Jardim Planalto<br />Araçatuba/SP</address>
            </section>
            <section>
              <h2 className="font-bold text-ink-900">Cultos</h2>
              <ul className="mt-1 space-y-1"><li>Quartas-feiras às 20:00</li><li>Domingos às 19:00</li></ul>
            </section>
          </div>
        </section>
        <PublicVisitorCheckInForm notice={visitorPrivacyNotice} />
      </div>
    </main>
  );
}
