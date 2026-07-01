"use client";

import { ScheduleMemberRole, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import type { MyScheduleListResult, MyScheduleSummary } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const roleLabels: Record<ScheduleMemberRole, string> = {
  LEADER: "Lider",
  VOCAL: "Vocal",
  INSTRUMENT: "Instrumento",
  MEDIA: "Midia",
  RECEPTION: "Recepcao",
  CHILDREN: "Infantil",
  SUPPORT: "Apoio",
  OTHER: "Outro"
};

const statusLabels: Record<ScheduleMemberStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  DECLINED: "Recusada",
  REPLACED: "Substituida",
  ABSENT: "Ausente"
};

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

  const loadSchedules = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/my-schedules", { cache: "no-store" });
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
  }, []);

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
        <div className="border-b border-hope-100 px-4 py-3">
          <p className="text-sm font-bold text-ink-900">Minhas participacoes</p>
          <p className="text-xs text-ink-500">{data.schedules.length} escala(s)</p>
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
                  <td className="px-4 py-4 font-semibold text-hope-700">{schedule.title}</td>
                  <td className="px-4 py-4 text-ink-700">{roleLabels[schedule.role]}</td>
                  <td className="px-4 py-4"><StatusBadge status={schedule.status} /></td>
                  <td className="px-4 py-4 text-ink-700">{schedule.location || "-"}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canSelfRespond(schedule) ? <ActionButton onClick={() => postAction(schedule.id, "confirm")}>Confirmar Presenca</ActionButton> : null}
                      {canSelfRespond(schedule) ? <ActionButton onClick={() => decline(schedule.id)}>Nao poderei participar</ActionButton> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const actionClass = "rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50";

function StatusBadge({ status }: { status: ScheduleMemberStatus }) {
  return <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">{statusLabels[status]}</span>;
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={actionClass}>{children}</button>;
}
