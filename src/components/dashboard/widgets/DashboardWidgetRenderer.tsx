import Link from "next/link";
import type { ReactNode } from "react";
import { StatCard } from "@/components/StatCard";
import { BirthdayMonthCard, TodayBirthdayCard, WeeklyBirthdaysCard } from "@/components/dashboard/BirthdayCard";
import type { AuthorizedDashboardWidget } from "@/types";

function formatCurrency(value: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function formatTimeRange(startTime: string | null, endTime: string | null) {
  return [startTime, endTime].filter(Boolean).join(" - ") || "Horario nao informado";
}

export function DashboardWidgetRenderer({ widget }: { widget: AuthorizedDashboardWidget }) {
  switch (widget.componentKey) {
    case "MEMBERS_BIRTHDAYS":
      return <div className="grid gap-6"><div className="grid gap-6 xl:grid-cols-2"><TodayBirthdayCard people={widget.data.today} admin /><WeeklyBirthdaysCard people={widget.data.weekly} admin /></div><BirthdayMonthCard data={widget.data} admin /></div>;
    case "MEMBERS_SUMMARY":
      return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Membros ativos" value={String(widget.data.activeMembers)} detail="Cadastros ativos e nao deletados" /><StatCard label="Novos membros no mes" value={String(widget.data.newMembersThisMonth)} detail="Com base na data de criacao" /></section>;
    case "FINANCE_REVENUE":
      return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Entradas do mes" value={formatCurrency(widget.data.monthlyIncome)} detail="Lancamentos confirmados" /></section>;
    case "FINANCE_BALANCE":
      return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Saldo do mes" value={formatCurrency(widget.data.monthlyBalance)} detail="Entradas confirmadas menos saidas confirmadas" /></section>;
    case "ANNOUNCEMENTS_SUMMARY":
      return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Comunicados publicados" value={String(widget.data.publishedAnnouncements)} detail="Publicados e nao deletados" /><StatCard label="Comunicados ativos" value={String(widget.data.activeAnnouncements)} detail="Visiveis no portal agora" /><StatCard label="Comunicados fixados" value={String(widget.data.pinnedAnnouncements)} detail="Destaques ativos no portal" /></section>;
    case "NOTIFICATIONS_HEALTH":
      return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Notificacoes hoje" value={String(widget.data.pushNotificationsSentToday)} detail="Envios com sucesso ou sucesso parcial" /><StatCard label="Taxa de sucesso push" value={`${widget.data.pushNotificationSuccessRate}%`} detail="Com base nos envios de hoje" /><StatCard label="Dispositivos ativos" value={String(widget.data.activePushDevices)} detail="Inscricoes push ativas" /><StatCard label="Dispositivos expirados" value={String(widget.data.expiredPushDevices)} detail="Detectados pela auditoria" /><StatCard label="Falhas em 24h" value={String(widget.data.pushFailuresLast24h)} detail="Tentativas sem sucesso" /><StatCard label="Reenvios push" value={String(widget.data.pushRetriesExecuted)} detail="Tentativas de recuperacao executadas" /><StatCard label="Dispositivos recuperados" value={String(widget.data.pushRecoveredDevices)} detail="Sucesso apos reenvio" /><StatCard label="Taxa final push" value={`${widget.data.pushFinalSuccessRate}%`} detail="Apos reenvios registrados" /></section>;
    case "EVENTS_UPCOMING":
      return <ListCard title={widget.title} subtitle={`${widget.data.events.length} evento(s) publicado(s)`} href="/eventos" linkLabel="Ver eventos" empty="Nenhum evento publicado futuro.">{widget.data.events.map((event) => <div key={event.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-ink-900">{event.title}</p><p className="text-sm text-ink-500">{event.location || "Local nao informado"}</p></div><span className="text-sm font-semibold text-hope-700">{formatDate(event.startDate)} - {event.startTime || "Horario nao informado"}</span></div>)}</ListCard>;
    case "SCALES_UPCOMING":
      return <ListCard title={widget.title} subtitle={`${widget.data.schedules.length} escala(s) futura(s)`} href="/escalas" linkLabel="Ver escalas" empty="Nenhuma escala futura encontrada.">{widget.data.schedules.map((schedule) => <div key={schedule.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-ink-900">{schedule.title}</p><p className="text-sm text-ink-500">{schedule.ministry.name} - {schedule.location || "Local nao informado"}</p></div><span className="text-sm font-semibold text-hope-700">{formatDate(schedule.date)} - {formatTimeRange(schedule.startTime, schedule.endTime)}</span></div>)}</ListCard>;
    case "FINANCE_SUMMARY":
      return <section className="rounded-md border border-hope-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-ink-900">{widget.title}</h2><dl className="mt-4 grid gap-3 text-sm"><SummaryRow label="Entradas" value={formatCurrency(widget.data.monthlyIncome)} className="text-emerald-700" /><SummaryRow label="Saidas" value={formatCurrency(widget.data.monthlyExpense)} className="text-red-700" /><SummaryRow label="Saldo" value={formatCurrency(widget.data.monthlyBalance)} className="text-hope-700" /></dl></section>;
    case "CONTRIBUTIONS_RECENT":
      return <ListCard title={widget.title} subtitle="Entradas recentes confirmadas" href="/financeiro/lancamentos" linkLabel="Ver lancamentos" empty="Nenhuma contribuicao confirmada encontrada.">{widget.data.contributions.map((contribution) => <div key={contribution.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-ink-900">{contribution.member?.displayName ?? "Contribuinte anonimo"}</p><p className="text-sm text-ink-500">{contribution.category.name} - #{contribution.entryNumber}</p></div><span className="text-sm font-semibold text-hope-700">{formatCurrency(contribution.amount)}</span></div>)}</ListCard>;
    default:
      return null;
  }
}

function ListCard({ title, subtitle, href, linkLabel, empty, children }: { title: string; subtitle: string; href: string; linkLabel: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="rounded-md border border-hope-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-hope-100 pb-3"><div><h2 className="text-lg font-bold text-ink-900">{title}</h2><p className="text-sm text-ink-500">{subtitle}</p></div><Link href={href} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">{linkLabel}</Link></div><div className="mt-4 divide-y divide-hope-100">{!hasChildren ? <p className="py-4 text-sm font-semibold text-ink-500">{empty}</p> : children}</div></section>;
}

function SummaryRow({ label, value, className }: { label: string; value: string; className: string }) {
  return <div className="flex items-center justify-between rounded-md bg-hope-50 px-3 py-3"><dt className="font-semibold text-ink-600">{label}</dt><dd className={`font-bold ${className}`}>{value}</dd></div>;
}
