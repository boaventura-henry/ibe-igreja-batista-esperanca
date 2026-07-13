"use client";

import { ScheduleMemberRole, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FormMessage } from "@/components/ui/FormMessage";
import type { ScheduleMemberFormValues, ScheduleSummary } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const roleOptions = [
  { value: ScheduleMemberRole.LEADER, label: "Lider" },
  { value: ScheduleMemberRole.VOCAL, label: "Vocal" },
  { value: ScheduleMemberRole.INSTRUMENT, label: "Instrumento" },
  { value: ScheduleMemberRole.MEDIA, label: "Midia" },
  { value: ScheduleMemberRole.RECEPTION, label: "Recepcao" },
  { value: ScheduleMemberRole.CHILDREN, label: "Infantil" },
  { value: ScheduleMemberRole.SUPPORT, label: "Apoio" },
  { value: ScheduleMemberRole.OTHER, label: "Outro" }
];

const statusOptions = [
  { value: ScheduleMemberStatus.PENDING, label: "Pendente" },
  { value: ScheduleMemberStatus.CONFIRMED, label: "Confirmado" },
  { value: ScheduleMemberStatus.DECLINED, label: "Recusou" },
  { value: ScheduleMemberStatus.REPLACED, label: "Substituido" },
  { value: ScheduleMemberStatus.ABSENT, label: "Ausente" }
];

const scheduleStatusLabels: Record<ScheduleStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  COMPLETED: "Concluida",
  CANCELED: "Cancelada"
};

const emptyMemberForm: ScheduleMemberFormValues = {
  memberId: "",
  role: ScheduleMemberRole.OTHER,
  status: ScheduleMemberStatus.PENDING,
  confirmedAt: "",
  replacedByMemberId: "",
  observations: "",
  allowMinistryException: false
};

function roleLabel(role: ScheduleMemberRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

function statusLabel(status: ScheduleMemberStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function normalizeMemberForm(form: ScheduleMemberFormValues) {
  return {
    memberId: form.memberId || undefined,
    role: form.role,
    status: form.status,
    confirmedAt: form.confirmedAt || undefined,
    replacedByMemberId: form.replacedByMemberId || undefined,
    observations: form.observations?.trim() || undefined,
    allowMinistryException: form.allowMinistryException
  };
}

export function ScheduleDetailManager({ initialSchedule }: { initialSchedule: ScheduleSummary }) {
  const { data: session } = useSession();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [message, setMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<ScheduleMemberFormValues>(emptyMemberForm);
  const [availableMembers, setAvailableMembers] = useState<Array<{ id: string; name: string; status: string }>>([]);

  const permissionCodes = session?.user.permissionCodes ?? [];
  const canUpdate = permissionCodes.includes("schedule.update");
  const canConfirm = permissionCodes.includes("schedule.confirm");
  const canDelete = permissionCodes.includes("schedule.delete");
  const isLocked = schedule.status === ScheduleStatus.COMPLETED || schedule.status === ScheduleStatus.CANCELED;

  useEffect(() => {
    async function loadFilters() {
      const response = await fetch("/api/schedules?pageSize=5", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<{ filters: { members: Array<{ id: string; name: string; status: string }> } }>;

      if (payload.success) {
        setAvailableMembers(payload.data.filters.members);
      }
    }

    loadFilters();
  }, []);

  async function reloadSchedule() {
    const response = await fetch(`/api/schedules/${schedule.id}`, { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse<ScheduleSummary>;

    if (payload.success) {
      setSchedule(payload.data);
    }
  }

  function updateForm<K extends keyof ScheduleMemberFormValues>(name: K, value: ScheduleMemberFormValues[K]) {
    setMemberForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "status" && value === ScheduleMemberStatus.CONFIRMED && !current.confirmedAt
        ? { confirmedAt: new Date().toISOString() }
        : {})
    }));
  }

  function openCreateForm() {
    setEditingId(null);
    setMemberForm(emptyMemberForm);
    setMessage("");
    setFormMessage("");
    setIsFormOpen(true);
  }

  function openEditForm(memberId: string) {
    const item = schedule.members.find((member) => member.id === memberId);

    if (!item) {
      return;
    }

    setEditingId(memberId);
    setMemberForm({
      memberId: item.member.id,
      role: item.role,
      status: item.status,
      confirmedAt: item.confirmedAt ?? "",
      replacedByMemberId: item.replacedByMember?.id ?? "",
      observations: item.observations ?? "",
      allowMinistryException: true
    });
    setMessage("");
    setFormMessage("");
    setIsFormOpen(true);
  }

  async function handleMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");

    try {
      const response = await fetch(
        editingId ? `/api/schedules/${schedule.id}/members/${editingId}` : `/api/schedules/${schedule.id}/members`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(normalizeMemberForm(memberForm))
        }
      );
      const payload = (await response.json()) as ApiResponse<unknown>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setIsFormOpen(false);
      setMessage(editingId ? "Membro da escala atualizado." : "Membro adicionado a escala.");
      await reloadSchedule();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o membro da escala.");
    }
  }

  async function updateMemberStatus(memberScheduleId: string, status: ScheduleMemberStatus) {
    const body = {
      status,
      confirmedAt: status === ScheduleMemberStatus.CONFIRMED ? new Date().toISOString() : undefined,
      allowMinistryException: true
    };
    const response = await fetch(`/api/schedules/${schedule.id}/members/${memberScheduleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as ApiResponse<unknown>;

    if (!payload.success) {
      setMessage(payload.error.message);
      return;
    }

    setMessage("Status atualizado.");
    await reloadSchedule();
  }

  async function removeMember(memberScheduleId: string) {
    if (!window.confirm("Deseja remover este membro da escala?")) {
      return;
    }

    const response = await fetch(`/api/schedules/${schedule.id}/members/${memberScheduleId}`, { method: "DELETE" });
    const payload = (await response.json()) as ApiResponse<unknown>;

    if (!payload.success) {
      setMessage(payload.error.message);
      return;
    }

    setMessage("Membro removido da escala.");
    await reloadSchedule();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <Info label="Ministerio" value={schedule.ministry.name} />
          <Info label="Data" value={formatDate(schedule.date)} />
          <Info label="Horario" value={[schedule.startTime, schedule.endTime].filter(Boolean).join(" - ") || "-"} />
          <Info label="Status" value={scheduleStatusLabels[schedule.status]} />
        </div>
        {schedule.description ? <p className="mt-4 text-sm text-ink-600">{schedule.description}</p> : null}
        {schedule.observations ? <p className="mt-2 text-sm text-ink-500">{schedule.observations}</p> : null}
      </section>

      {message ? <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">{message}</div> : null}

      <section className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-hope-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-ink-900">Membros escalados</h2>
            <p className="text-xs text-ink-500">{schedule.members.length} participante(s)</p>
          </div>
          {canUpdate && !isLocked ? <button type="button" onClick={openCreateForm} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Adicionar membro</button> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Membro</th>
                <th className="px-4 py-3">Funcao</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Substituto</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {schedule.members.length === 0 ? (
                <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={5}>Nenhum membro escalado.</td></tr>
              ) : null}
              {schedule.members.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 font-semibold text-ink-900">{item.member.name}</td>
                  <td className="px-4 py-4 text-ink-700">{roleLabel(item.role)}</td>
                  <td className="px-4 py-4 text-ink-700">{statusLabel(item.status)}</td>
                  <td className="px-4 py-4 text-ink-700">{item.replacedByMember?.name ?? "-"}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canUpdate && !isLocked ? <ActionButton onClick={() => openEditForm(item.id)}>Editar</ActionButton> : null}
                      {canConfirm ? <ActionButton onClick={() => updateMemberStatus(item.id, ScheduleMemberStatus.CONFIRMED)}>Confirmar</ActionButton> : null}
                      {canConfirm ? <ActionButton onClick={() => updateMemberStatus(item.id, ScheduleMemberStatus.ABSENT)}>Ausencia</ActionButton> : null}
                      {canDelete && !isLocked ? <ActionButton onClick={() => removeMember(item.id)}>Remover</ActionButton> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
          <div className="mx-auto max-w-2xl rounded-md bg-white shadow-soft">
            <form onSubmit={handleMemberSubmit}>
              <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">{editingId ? "Editar membro escalado" : "Adicionar membro"}</h2>
                  <p className="text-sm text-ink-500">Funcao, confirmacao, ausencia ou substituicao.</p>
                </div>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">Fechar</button>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FormMessage id="schedule-member-form-message">{formMessage}</FormMessage>
                </div>
                <Field label="Membro">
                  <select required value={memberForm.memberId} onChange={(event) => updateForm("memberId", event.target.value)} className={inputClass}>
                    <option value="">Selecione</option>
                    {availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </Field>
                <Field label="Funcao">
                  <select value={memberForm.role} onChange={(event) => updateForm("role", event.target.value as ScheduleMemberRole)} className={inputClass}>
                    {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={memberForm.status} onChange={(event) => updateForm("status", event.target.value as ScheduleMemberStatus)} className={inputClass}>
                    {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </Field>
                <Field label="Substituto">
                  <select value={memberForm.replacedByMemberId ?? ""} onChange={(event) => updateForm("replacedByMemberId", event.target.value)} className={inputClass}>
                    <option value="">Nenhum</option>
                    {availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </Field>
                <Field label="Confirmado em" className="md:col-span-2">
                  <input type="datetime-local" value={memberForm.confirmedAt?.slice(0, 16) ?? ""} onChange={(event) => updateForm("confirmedAt", event.target.value ? new Date(event.target.value).toISOString() : "")} className={inputClass} />
                </Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink-700 md:col-span-2">
                  <input type="checkbox" checked={memberForm.allowMinistryException} onChange={(event) => updateForm("allowMinistryException", event.target.checked)} />
                  Permitir excecao para membro fora do ministerio
                </label>
                <Field label="Observacoes" className="md:col-span-2">
                  <textarea value={memberForm.observations ?? ""} onChange={(event) => updateForm("observations", event.target.value)} className={`${inputClass} min-h-20`} />
                </Field>
              </div>
              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">Cancelar</button>
                <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Salvar membro</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";
const actionClass = "rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={actionClass}>{children}</button>;
}
