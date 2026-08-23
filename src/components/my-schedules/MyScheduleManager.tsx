"use client";

import { ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import type { MyScheduleListResult, MyScheduleSummary } from "@/types";
import { PortalScheduleRepertoire } from "@/components/portal/PortalScheduleRepertoire";
import { ScheduleMemberStatusBadge } from "@/components/schedules/ScheduleMemberStatusBadge";
import { getScheduleMemberDisplayRole, hasInstrumentRole } from "@/lib/schedule-member-role";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function formatTime(schedule: MyScheduleSummary) {
  return [schedule.startTime, schedule.endTime].filter(Boolean).join(" - ") || "Horario nao informado";
}

function canSelfRespond(schedule: MyScheduleSummary) {
  return schedule.status === ScheduleMemberStatus.PENDING &&
    schedule.scheduleStatus !== ScheduleStatus.CANCELED &&
    schedule.scheduleStatus !== ScheduleStatus.COMPLETED;
}

export function MyScheduleManager({ initialData }: { initialData: MyScheduleListResult }) {
  const [data, setData] = useState(initialData);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [instrumentScheduleMemberId, setInstrumentScheduleMemberId] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/my-schedules?includeCompleted=${includeCompleted}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as ApiResponse<MyScheduleListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar suas escalas.");
    } finally {
      setIsLoading(false);
    }
  }, [includeCompleted]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  async function postAction(scheduleMemberId: string, action: "confirm" | "decline", body?: Record<string, string>) {
    setMessage("");

    try {
      const response = await fetch(`/api/my-schedules/${scheduleMemberId}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = (await response.json()) as ApiResponse<MyScheduleSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage(action === "confirm" ? "Presenca confirmada." : "Participacao recusada.");
      await loadSchedules();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel responder a escala.");
    }
  }

  function decline(scheduleMemberId: string) {
    const reason = window.prompt("Informe o motivo da recusa:");

    if (reason === null) {
      return;
    }

    void postAction(scheduleMemberId, "decline", { declineReason: reason });
  }

  return (
    <div className="space-y-5">
      {message ? <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">{message}</div> : null}

      <section className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hope-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Minhas participacoes</p>
            <p className="text-xs text-ink-500">{data.schedules.length} escala(s)</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
            <input type="checkbox" checked={includeCompleted} onChange={(event) => setIncludeCompleted(event.target.checked)} />
            Apresentar todos
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Ministerio</th>
                <th className="px-4 py-3">Escala</th>
                <th className="px-4 py-3">Funcao</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? (
                <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>Carregando suas escalas...</td></tr>
              ) : null}
              {!isLoading && data.schedules.length === 0 ? (
                <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>Nenhuma escala encontrada para seu membro vinculado.</td></tr>
              ) : null}
              {data.schedules.map((schedule) => (
                <tr key={schedule.id} className="align-top">
                  <td className="px-4 py-4 text-ink-700">
                    <p className="font-semibold text-ink-900">{formatDate(schedule.date)}</p>
                    <p className="text-xs text-ink-500">{formatTime(schedule)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded" style={{ backgroundColor: schedule.ministry.color }} />
                      <span className="font-semibold text-ink-900">{schedule.ministry.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-hope-700">{schedule.title}<PortalScheduleRepertoire scheduleMemberId={schedule.id} /></td>
                  <td className="px-4 py-4 text-ink-700">{getScheduleMemberDisplayRole(schedule.role, schedule.instrumentAssignment)}</td>
                  <td className="px-4 py-4"><ScheduleMemberStatusBadge status={schedule.status} /></td>
                  <td className="px-4 py-4 text-ink-700">{schedule.location || "-"}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canSelfRespond(schedule) ? <ActionButton onClick={() => postAction(schedule.id, "confirm")}>Confirmar Presenca</ActionButton> : null}
                      {canSelfRespond(schedule) ? <ActionButton onClick={() => decline(schedule.id)}>Nao poderei participar</ActionButton> : null}
                      {hasInstrumentRole(schedule) && schedule.status !== ScheduleMemberStatus.REPLACED && schedule.status !== ScheduleMemberStatus.DECLINED && schedule.status !== ScheduleMemberStatus.ABSENT && schedule.scheduleStatus === ScheduleStatus.PUBLISHED && schedule.instrumentAssignment ? <ActionButton onClick={() => setInstrumentScheduleMemberId(schedule.id)}>Alterar instrumento</ActionButton> : null}
                      {hasInstrumentRole(schedule) && schedule.status !== ScheduleMemberStatus.REPLACED && schedule.status !== ScheduleMemberStatus.DECLINED && schedule.status !== ScheduleMemberStatus.ABSENT && schedule.scheduleStatus === ScheduleStatus.PUBLISHED && !schedule.instrumentAssignment ? <span className="self-center text-xs font-semibold text-ink-500">Instrumento ainda nao definido.</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {instrumentScheduleMemberId ? <InstrumentChangeModal scheduleMemberId={instrumentScheduleMemberId} onClose={() => setInstrumentScheduleMemberId(null)} onSaved={async (savedMessage) => { setMessage(savedMessage); setInstrumentScheduleMemberId(null); await loadSchedules(); }} /> : null}
    </div>
  );
}

const actionClass = "rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50";

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={actionClass}>{children}</button>;
}

type InstrumentChangeData = { category: { id: string; name: string } | null; current: { id: string; source: "REGISTERED" | "OWN"; instrument?: { id: string; name: string; status: string; deletedAt?: string | null } | null } | null; instruments: Array<{ id: string; name: string; brand?: string | null; model?: string | null }> };
function InstrumentChangeModal({ scheduleMemberId, onClose, onSaved }: { scheduleMemberId: string; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [data, setData] = useState<InstrumentChangeData | null>(null); const [source, setSource] = useState<"REGISTERED" | "OWN">("REGISTERED"); const [instrumentId, setInstrumentId] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { void fetch(`/api/my-schedules/${scheduleMemberId}/instrument`).then(async r => { const p = await r.json() as ApiResponse<InstrumentChangeData>; if (!p.success) throw new Error(p.error.message); return p.data; }).then((value) => { setData(value); setSource(value.current?.source ?? "REGISTERED"); setInstrumentId(value.current?.instrument?.id ?? ""); }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Nao foi possivel carregar o instrumento.")); }, [scheduleMemberId]);
  async function save(event: React.FormEvent) { event.preventDefault(); if (saving) return; setSaving(true); setError(""); try { const response = await fetch(`/api/my-schedules/${scheduleMemberId}/instrument`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, instrumentId: source === "REGISTERED" ? instrumentId : null, changeReason: reason || null, currentAssignmentId: data?.current?.id }) }); const payload = await response.json() as ApiResponse<unknown>; if (!payload.success) throw new Error(payload.error.message); await onSaved(source === "OWN" ? "Instrumento proprio registrado com sucesso." : "Instrumento atualizado com sucesso."); } catch (e) { setError(e instanceof Error ? e.message : "Nao foi possivel atualizar o instrumento."); } finally { setSaving(false); } }
  const current = data?.current?.source === "OWN" ? "Instrumento proprio" : data?.current?.instrument?.name ?? "Nao informado";
  return <div role="dialog" aria-modal="true" aria-label="Alterar instrumento" className="fixed inset-0 z-50 overflow-y-auto bg-ink-900/45 p-4"><form onSubmit={save} className="mx-auto my-8 max-w-lg rounded-md bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-ink-900">Alterar instrumento</h2><p className="text-sm text-ink-600">Categoria: <strong>{data?.category?.name ?? "Nao informada"}</strong></p></div><button type="button" className={actionClass} onClick={onClose}>Fechar</button></div><p className="mt-4 text-sm text-ink-700">Instrumento atual: <strong>{current}</strong></p>{error ? <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}{!data && !error ? <p className="mt-4 text-sm">Carregando...</p> : null}{data ? <><fieldset className="mt-4 grid gap-2"><legend className="text-sm font-bold">Alterar para</legend><label><input type="radio" checked={source === "REGISTERED"} onChange={() => setSource("REGISTERED")} /> Instrumento da igreja</label><label><input type="radio" checked={source === "OWN"} onChange={() => setSource("OWN")} /> Instrumento proprio</label></fieldset>{source === "REGISTERED" ? <label className="mt-4 grid gap-1 text-sm font-bold">Instrumento<select required value={instrumentId} onChange={e => setInstrumentId(e.target.value)} className="rounded border p-2"><option value="">{data.instruments.length ? "Selecione" : "Nenhum instrumento da igreja disponivel"}</option>{data.instruments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label> : null}<label className="mt-4 grid gap-1 text-sm font-bold">Motivo da alteracao<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} className="rounded border p-2" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" className={actionClass} onClick={onClose}>Cancelar</button><button disabled={saving || (source === "REGISTERED" && !instrumentId)} className="rounded-md bg-hope-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button></div></> : null}</form></div>;
}
