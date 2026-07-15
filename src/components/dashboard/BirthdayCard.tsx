"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BirthdayDashboardData, BirthdayPerson } from "@/types";
import type { ApiResponseBody } from "@/types/api";

export function birthdayMessage(name: string) {
  return `🎉 Hoje queremos parabenizar ${name} pelo seu aniversário!\n\nQue Deus continue abençoando sua vida, sua família e seu ministério.\n\nFeliz aniversário!\n\n🎂🙏`;
}

export function TodayBadge() {
  return <span className="inline-flex items-center rounded-full bg-hope-600 px-2 py-1 text-[0.65rem] font-black uppercase tracking-wide text-white shadow-sm animate-[pulse_3s_ease-in-out_infinite]">🎂 Hoje</span>;
}

export function CopyBirthdayButton({ name }: { name: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    const text = birthdayMessage(name);

    try {
      if (!navigator.clipboard) throw new Error("Clipboard indisponivel");
      await navigator.clipboard.writeText(text);
      setMessage("Mensagem copiada.");
    } catch {
      window.prompt("Copie a mensagem de parabéns", text);
      setMessage("Use a janela exibida para copiar a mensagem.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void copy()} className="rounded-md border border-hope-200 px-3 py-2 text-xs font-bold text-hope-700">
        Copiar mensagem
      </button>
      {message ? <span className="text-xs font-semibold text-emerald-700" role="status">{message}</span> : null}
    </div>
  );
}

function PersonRow({ person, admin = false, showDate = false, showCopy = false }: { person: BirthdayPerson; admin?: boolean; showDate?: boolean; showCopy?: boolean }) {
  const content = (
    <div className="flex min-w-0 items-center gap-3">
      {person.photoUrl ? <img src={person.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-hope-100 text-lg">🎂</div>}
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink-900">{person.displayName}</p>
        {person.ministry ? <p className="truncate text-xs text-ink-500">{person.ministry.name}</p> : <p className="text-xs text-ink-500">Ministério não informado</p>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hope-100 p-3 sm:flex-row sm:items-center sm:justify-between">
      {admin ? <Link href={`/membros/${person.id}`} className="min-w-0 hover:opacity-80">{content}</Link> : content}
      <div className="flex flex-wrap items-center gap-3">
        {person.isToday ? <TodayBadge /> : null}
        {showDate ? <span className="text-sm font-bold text-hope-700">{String(person.birthdayDay).padStart(2, "0")}/{String(person.birthdayMonth).padStart(2, "0")}</span> : null}
        {showCopy ? <CopyBirthdayButton name={person.displayName} /> : null}
      </div>
    </div>
  );
}

export function BirthdayMonthCard({ data, admin = false }: { data: BirthdayDashboardData; admin?: boolean }) {
  const groups = new Map<number, BirthdayPerson[]>();

  for (const person of data.month) {
    const people = groups.get(person.birthdayDay) ?? [];
    people.push(person);
    groups.set(person.birthdayDay, people);
  }

  return (
    <section className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hope-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Aniversariantes de {data.monthLabel}</h2>
          <p className="text-sm text-ink-500">{data.monthCount} aniversariante(s) neste mês</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {groups.size === 0 ? <p className="text-sm font-semibold text-ink-500">Nenhum aniversariante neste mês.</p> : null}
        {[...groups.entries()].map(([day, people]) => (
          <div key={day} className="grid gap-2 sm:grid-cols-[3rem_1fr] sm:items-start">
            <span className="text-lg font-black text-hope-700">{String(day).padStart(2, "0")}</span>
            <div className="grid gap-2">{people.map((person) => <PersonRow key={person.id} person={person} admin={admin} />)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BirthdayCard({ endpoint }: { endpoint: string }) {
  const [data, setData] = useState<BirthdayDashboardData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store" })
      .then(async (response) => (await response.json()) as ApiResponseBody<BirthdayDashboardData>)
      .then((body) => {
        if (!active) return;
        if (body.success) setData(body.data);
        else setMessage(body.error.message);
      })
      .catch(() => { if (active) setMessage("Não foi possível carregar os aniversariantes."); });
    return () => { active = false; };
  }, [endpoint]);

  if (message) return <div className="rounded-md border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{message}</div>;
  if (!data) return <div className="rounded-md border border-hope-100 bg-white p-5 text-sm font-semibold text-ink-600 shadow-sm">Carregando aniversariantes...</div>;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <TodayBirthdayCard people={data.today} admin />
        <WeeklyBirthdaysCard people={data.weekly} admin />
      </div>
      <BirthdayMonthCard data={data} admin />
    </div>
  );
}

export function TodayBirthdayCard({ people, admin = false }: { people: BirthdayPerson[]; admin?: boolean }) {
  return (
    <section className="rounded-md border border-hope-200 bg-hope-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-ink-900">Aniversariante do Dia</h2>
        <TodayBadge />
      </div>
      <div className="mt-4 grid gap-3">
        {people.length === 0 ? <p className="text-sm font-semibold text-ink-600">Nenhum aniversariante hoje.</p> : people.map((person) => <PersonRow key={person.id} person={person} admin={admin} showCopy />)}
      </div>
    </section>
  );
}

export function WeeklyBirthdaysCard({ people, admin = false }: { people: BirthdayPerson[]; admin?: boolean }) {
  return (
    <section className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-ink-900">Aniversariantes da Semana</h2>
      <p className="mt-1 text-sm text-ink-500">Segunda-feira a domingo</p>
      <div className="mt-4 grid gap-3">
        {people.length === 0 ? <p className="text-sm font-semibold text-ink-500">Nenhum aniversariante nesta semana.</p> : people.map((person) => <PersonRow key={person.id} person={person} admin={admin} showDate />)}
      </div>
    </section>
  );
}
