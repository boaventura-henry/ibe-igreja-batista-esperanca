"use client";

import { ScheduleMemberRole, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { FormEvent, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  getScheduleMemberRoles,
  getScheduleMemberDisplayRole,
  hasInstrumentRole,
  normalizeScheduleMemberRoles,
  scheduleMemberRoleOptions
} from "@/lib/schedule-member-role";
import { getMemberOptionLabel } from "@/utils";
import { FormMessage } from "@/components/ui/FormMessage";
import { ScheduleRepertoireManager } from "@/components/schedules/ScheduleRepertoireManager";
import {
  getScheduleMemberStatusPresentation,
  ScheduleMemberStatusBadge
} from "@/components/schedules/ScheduleMemberStatusBadge";
import type {
  ScheduleInstrumentSuggestion,
  ScheduleMemberFormValues,
  ScheduleSummary
} from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

type AvailableScheduleMember = { id: string; name: string; nickname: string | null; displayName: string; status: string };
type InstrumentCategoryOption = { id: string; name: string; isActive: boolean };
type EligibleInstrument = { id: string; name: string; brand: string | null; model: string | null; status: string };
type InstrumentAssignmentDraft = { instrumentCategoryId: string; source: "" | "REGISTERED" | "OWN"; instrumentId: string };
type MemberForm = Omit<ScheduleMemberFormValues, "role" | "roles" | "instrumentAssignment"> & {
  roles: ScheduleMemberRole[];
  instrumentAssignment?: InstrumentAssignmentDraft;
};

const statusOptions = [
  ScheduleMemberStatus.PENDING,
  ScheduleMemberStatus.CONFIRMED,
  ScheduleMemberStatus.DECLINED,
  ScheduleMemberStatus.REPLACED,
  ScheduleMemberStatus.ABSENT
].map((value) => ({
  value,
  label: getScheduleMemberStatusPresentation(value).label
}));

const scheduleStatusLabels: Record<ScheduleStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  COMPLETED: "Concluida",
  CANCELED: "Cancelada"
};

const emptyMemberForm: MemberForm = {
  memberId: "",
  roles: [],
  status: ScheduleMemberStatus.PENDING,
  confirmedAt: "",
  replacedByMemberId: "",
  observations: "",
  allowMinistryException: false
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function instrumentLabel(instrument: EligibleInstrument, historical = false) {
  return instrument.name + (historical && instrument.status !== "ACTIVE" ? " (Indisponivel)" : "");
}

function normalizeMemberForm(form: MemberForm, allowMissingHistoricalAssignment = false) {
  if (!form.roles.length) {
    throw new Error("Informe pelo menos uma funcao.");
  }

  const payload = {
    memberId: form.memberId || undefined,
    roles: form.roles,
    status: form.status,
    confirmedAt: form.confirmedAt || undefined,
    replacedByMemberId: form.replacedByMemberId || undefined,
    observations: form.observations?.trim() || undefined,
    allowMinistryException: form.allowMinistryException
  };

  if (
    !hasInstrumentRole({ roles: form.roles }) ||
    form.status === ScheduleMemberStatus.REPLACED
  ) {
    return payload;
  }

  const assignment = form.instrumentAssignment;

  if (!assignment) {
    if (allowMissingHistoricalAssignment) {
      return payload;
    }

    throw new Error("Informe a categoria musical.");
  }

  if (!assignment.instrumentCategoryId && !assignment.source && !assignment.instrumentId) {
    if (allowMissingHistoricalAssignment) {
      return payload;
    }

    throw new Error("Informe a categoria musical.");
  }

  if (!assignment.instrumentCategoryId) {
    throw new Error("Informe a categoria musical.");
  }

  if (!assignment.source) {
    throw new Error("Informe a origem do instrumento.");
  }

  if (assignment.source === "REGISTERED" && !assignment.instrumentId) {
    throw new Error("Selecione o instrumento da igreja.");
  }

  return {
    ...payload,
    instrumentAssignment: {
      instrumentCategoryId: assignment.instrumentCategoryId,
      source: assignment.source,
      instrumentId: assignment.source === "REGISTERED" ? assignment.instrumentId : null
    }
  };
}

export function ScheduleDetailManager({ initialSchedule }: { initialSchedule: ScheduleSummary }) {
  const { data: session } = useSession();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [message, setMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<MemberForm>(emptyMemberForm);
  const [availableMembers, setAvailableMembers] = useState<AvailableScheduleMember[]>([]);
  const [instrumentCategories, setInstrumentCategories] = useState<InstrumentCategoryOption[]>([]);
  const [eligibleInstruments, setEligibleInstruments] = useState<EligibleInstrument[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [isInstrumentsLoading, setIsInstrumentsLoading] = useState(false);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const instrumentRequest = useRef(0);
  const suggestionRequest = useRef(0);
  const suggestedMember = useRef<string | null>(null);

  const permissionCodes = session?.user.permissionCodes ?? [];
  const canUpdate = permissionCodes.includes("schedule.update");
  const canConfirm = permissionCodes.includes("schedule.confirm");
  const canDelete = permissionCodes.includes("schedule.delete");
  const isLocked = schedule.status === ScheduleStatus.COMPLETED || schedule.status === ScheduleStatus.CANCELED;

  const selectedScheduleMember = editingId ? schedule.members.find((member) => member.id === editingId) : null;
  const historicalAssignment = selectedScheduleMember?.instrumentAssignment ?? null;
  const showInstrumentFields =
    hasInstrumentRole({ roles: memberForm.roles }) &&
    memberForm.status !== ScheduleMemberStatus.REPLACED;
  const categoryOptions = useMemo(() => {
    const current = historicalAssignment?.instrumentCategory;

    if (current && !instrumentCategories.some((category) => category.id === current.id)) {
      return [{ id: current.id, name: current.name, isActive: false }, ...instrumentCategories];
    }

    return instrumentCategories;
  }, [historicalAssignment, instrumentCategories]);
  const instrumentOptions = useMemo(() => {
    const current = historicalAssignment?.instrument;

    if (
      current &&
      memberForm.instrumentAssignment?.source === "REGISTERED" &&
      memberForm.instrumentAssignment.instrumentCategoryId === historicalAssignment?.instrumentCategory.id &&
      !eligibleInstruments.some((instrument) => instrument.id === current.id)
    ) {
      return [current, ...eligibleInstruments];
    }

    return eligibleInstruments;
  }, [eligibleInstruments, historicalAssignment, memberForm.instrumentAssignment]);
  const selectableMembers = useMemo(() => {
    if (!memberForm.memberId || availableMembers.some((member) => member.id === memberForm.memberId)) {
      return availableMembers;
    }

    const selectedMember = selectedScheduleMember?.member;

    return selectedMember ? [selectedMember, ...availableMembers] : availableMembers;
  }, [availableMembers, memberForm.memberId, selectedScheduleMember]);

  async function loadAvailableMembers(allowMinistryException: boolean, selectedMember?: AvailableScheduleMember) {
    try {
      const response = await fetch(
        `/api/schedules/${schedule.id}/available-members?allowMinistryException=${allowMinistryException}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as ApiResponse<{ members: AvailableScheduleMember[] }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setAvailableMembers(payload.data.members);

      if (selectedMember && !allowMinistryException && !payload.data.members.some((member) => member.id === selectedMember.id)) {
        setFormMessage("Este participante nao pertence ao ministerio da escala. Remova-o ou mantenha a opcao de excecao habilitada.");
      }
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os membros disponiveis.");
    }
  }

  async function loadInstrumentCategories() {
    setIsCategoriesLoading(true);

    try {
      const response = await fetch("/api/instrument-categories?isActive=true&pageSize=100", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<{ categories: InstrumentCategoryOption[] }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setInstrumentCategories(payload.data.categories);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Nao foi possivel carregar as categorias musicais.");
    } finally {
      setIsCategoriesLoading(false);
    }
  }

  async function loadEligibleInstruments(categoryId: string) {
    const requestId = ++instrumentRequest.current;

    if (!categoryId) {
      setEligibleInstruments([]);
      setIsInstrumentsLoading(false);
      return;
    }

    setIsInstrumentsLoading(true);

    try {
      const response = await fetch(
        "/api/schedules/" + schedule.id + "/eligible-instruments?categoryId=" + encodeURIComponent(categoryId),
        { cache: "no-store" }
      );
      const payload = (await response.json()) as ApiResponse<{ instruments: EligibleInstrument[] }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      if (requestId === instrumentRequest.current) {
        setEligibleInstruments(payload.data.instruments);
      }
    } catch (error) {
      if (requestId === instrumentRequest.current) {
        setEligibleInstruments([]);
        setFormMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os instrumentos elegiveis.");
      }
    } finally {
      if (requestId === instrumentRequest.current) {
        setIsInstrumentsLoading(false);
      }
    }
  }

  async function loadInstrumentSuggestion(memberId: string) {
    const requestId = ++suggestionRequest.current;
    setIsSuggestionLoading(true);

    try {
      const response = await fetch(
        "/api/schedules/" + schedule.id + "/instrument-suggestion?memberId=" + encodeURIComponent(memberId),
        { cache: "no-store" }
      );
      const payload = (await response.json()) as ApiResponse<ScheduleInstrumentSuggestion>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      if (requestId !== suggestionRequest.current) {
        return;
      }

      if (!payload.data.hasSuggestion) {
        suggestedMember.current = null;
        setSuggestionMessage("");
        return;
      }

      const category = payload.data.instrumentCategory;
      const source = payload.data.source;
      setMemberForm((current) => {
        if (current.memberId !== memberId || requestId !== suggestionRequest.current) {
          return current;
        }

        return {
          ...current,
          roles: normalizeScheduleMemberRoles([
            ...current.roles,
            ScheduleMemberRole.INSTRUMENT
          ]),
          instrumentAssignment:
            category && source
              ? {
                  instrumentCategoryId: category.id,
                  source,
                  instrumentId:
                    source === "REGISTERED" ? payload.data.instrument?.id ?? "" : ""
                }
              : undefined
        };
      });
      suggestedMember.current = memberId;
      setSuggestionMessage(
        category && source
          ? "Sugestao baseada na ultima escala como instrumentista."
          : "Existe historico instrumental, mas a configuracao anterior nao esta mais disponivel."
      );

      if (category && source === "REGISTERED") {
        void loadEligibleInstruments(category.id);
      }
    } catch (error) {
      if (requestId === suggestionRequest.current) {
        suggestedMember.current = null;
        setSuggestionMessage("");
        setFormMessage(
          error instanceof Error
            ? error.message
            : "Nao foi possivel consultar a configuracao instrumental anterior."
        );
      }
    } finally {
      if (requestId === suggestionRequest.current) {
        setIsSuggestionLoading(false);
      }
    }
  }

  function updateMemberId(memberId: string) {
    suggestionRequest.current += 1;
    setIsSuggestionLoading(false);
    setSuggestionMessage("");
    setMemberForm((current) => ({
      ...current,
      memberId,
      roles: [],
      instrumentAssignment: undefined
    }));
    instrumentRequest.current += 1;
    setEligibleInstruments([]);
    setIsInstrumentsLoading(false);
    suggestedMember.current = null;

    if (memberId && (!editingId || memberId !== selectedScheduleMember?.member.id)) {
      void loadInstrumentSuggestion(memberId);
    }
  }

  function updateAllowMinistryException(value: boolean) {
    updateForm("allowMinistryException", value);
    void loadAvailableMembers(value, selectedScheduleMember?.member);
  }

  async function reloadSchedule() {
    const response = await fetch(`/api/schedules/${schedule.id}`, { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse<ScheduleSummary>;

    if (payload.success) {
      setSchedule(payload.data);
    }
  }

  function updateForm<K extends keyof MemberForm>(name: K, value: MemberForm[K]) {
    setMemberForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "status" && value === ScheduleMemberStatus.CONFIRMED && !current.confirmedAt
        ? { confirmedAt: new Date().toISOString() }
        : {})
    }));
  }

  function updateRole(role: ScheduleMemberRole, checked: boolean) {
    suggestionRequest.current += 1;
    setIsSuggestionLoading(false);
    setSuggestionMessage("");
    setMemberForm((current) => ({
      ...current,
      roles: normalizeScheduleMemberRoles(
        checked
          ? [...current.roles, role]
          : current.roles.filter((currentRole) => currentRole !== role)
      ),
      ...(!checked && role === ScheduleMemberRole.INSTRUMENT
        ? { instrumentAssignment: undefined }
        : {})
    }));

    if (!checked && role === ScheduleMemberRole.INSTRUMENT) {
      instrumentRequest.current += 1;
      setEligibleInstruments([]);
      setIsInstrumentsLoading(false);
      setFormMessage("");
    }
  }

  function updateInstrumentCategory(instrumentCategoryId: string) {
    const source = memberForm.instrumentAssignment?.source ?? "";

    setMemberForm((form) => ({
      ...form,
      instrumentAssignment: { instrumentCategoryId, source, instrumentId: "" }
    }));
    setEligibleInstruments([]);

    if (source === "REGISTERED" && instrumentCategoryId) {
      void loadEligibleInstruments(instrumentCategoryId);
    }
  }

  function updateInstrumentSource(source: InstrumentAssignmentDraft["source"]) {
    const instrumentCategoryId = memberForm.instrumentAssignment?.instrumentCategoryId ?? "";

    setMemberForm((form) => ({
      ...form,
      instrumentAssignment: { instrumentCategoryId, source, instrumentId: "" }
    }));

    if (source === "REGISTERED" && instrumentCategoryId) {
      void loadEligibleInstruments(instrumentCategoryId);
    } else {
      instrumentRequest.current += 1;
      setEligibleInstruments([]);
      setIsInstrumentsLoading(false);
    }
  }

  function updateInstrumentId(instrumentId: string) {
    setMemberForm((form) => ({
      ...form,
      instrumentAssignment: {
        instrumentCategoryId: form.instrumentAssignment?.instrumentCategoryId ?? "",
        source: form.instrumentAssignment?.source ?? "",
        instrumentId
      }
    }));
  }

  function openCreateForm() {
    suggestionRequest.current += 1;
    suggestedMember.current = null;
    setEditingId(null);
    setMemberForm(emptyMemberForm);
    setAvailableMembers([]);
    setInstrumentCategories([]);
    setEligibleInstruments([]);
    setIsSuggestionLoading(false);
    setSuggestionMessage("");
    setMessage("");
    setFormMessage("");
    setIsFormOpen(true);
    void loadAvailableMembers(false);
    void loadInstrumentCategories();
  }

  function openEditForm(memberId: string) {
    const item = schedule.members.find((member) => member.id === memberId);

    if (!item) {
      return;
    }

    suggestionRequest.current += 1;
    suggestedMember.current = null;
    setEditingId(memberId);
    const assignment = item.instrumentAssignment;
    setMemberForm({
      memberId: item.member.id,
      roles: getScheduleMemberRoles(item),
      status: item.status,
      confirmedAt: item.confirmedAt ?? "",
      replacedByMemberId: item.replacedByMember?.id ?? "",
      observations: item.observations ?? "",
      allowMinistryException: false,
      instrumentAssignment: assignment
        ? {
            instrumentCategoryId: assignment.instrumentCategory.id,
            source: assignment.source,
            instrumentId: assignment.instrument?.id ?? ""
          }
        : undefined
    });
    setAvailableMembers([]);
    setInstrumentCategories([]);
    setEligibleInstruments([]);
    setIsSuggestionLoading(false);
    setSuggestionMessage("");
    setMessage("");
    setFormMessage("");
    setIsFormOpen(true);
    void loadAvailableMembers(false, item.member);
    void loadInstrumentCategories();

    if (assignment?.source === "REGISTERED") {
      void loadEligibleInstruments(assignment.instrumentCategory.id);
    }
  }

  async function handleMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFormMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        editingId ? `/api/schedules/${schedule.id}/members/${editingId}` : `/api/schedules/${schedule.id}/members`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            normalizeMemberForm(
              memberForm,
              Boolean(
                editingId &&
                selectedScheduleMember &&
                hasInstrumentRole(selectedScheduleMember) &&
                !selectedScheduleMember.instrumentAssignment
              )
            )
          )
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
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateMemberStatus(memberScheduleId: string, status: ScheduleMemberStatus) {
    const body = {
      status,
      confirmedAt: status === ScheduleMemberStatus.CONFIRMED ? new Date().toISOString() : undefined
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
                  <td className="px-4 py-4 font-semibold text-ink-900">{item.member.displayName}</td>
                  <td className="px-4 py-4 text-ink-700">{getScheduleMemberDisplayRole(item.role, item.instrumentAssignment)}</td>
                  <td className="px-4 py-4"><ScheduleMemberStatusBadge status={item.status} /></td>
                  <td className="px-4 py-4 text-ink-700">{item.replacedByMember?.displayName ?? "-"}</td>
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

      <ScheduleRepertoireManager scheduleId={schedule.id} scheduleTitle={schedule.title} canUpdate={canUpdate} />

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
          <div className="mx-auto max-w-2xl rounded-md bg-white shadow-soft">
            <form onSubmit={handleMemberSubmit}>
              <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">{editingId ? "Editar membro escalado" : "Adicionar membro"}</h2>
                  <p className="text-sm text-ink-500">Funções, confirmação, ausência ou substituição.</p>
                </div>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">Fechar</button>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FormMessage id="schedule-member-form-message">{formMessage}</FormMessage>
                </div>
                <Field label="Membro">
                  <select
                    required
                    value={memberForm.memberId}
                    onChange={(event) => updateMemberId(event.target.value)}
                    className={inputClass}
                    aria-busy={isSuggestionLoading}
                  >
                    <option value="">Selecione</option>
                    {selectableMembers.map((member) => <option key={member.id} value={member.id}>{getMemberOptionLabel(member)}</option>)}
                  </select>
                  {!memberForm.allowMinistryException && availableMembers.length === 0 ? (
                    <span className="text-xs font-semibold normal-case tracking-normal text-ink-500">Nao ha membros ativos vinculados a este ministerio.</span>
                  ) : null}
                  {isSuggestionLoading ? (
                    <span className="text-xs font-semibold normal-case tracking-normal text-ink-500" role="status">
                      Consultando ultima configuracao instrumental...
                    </span>
                  ) : null}
                  {suggestionMessage ? (
                    <span className="text-xs font-semibold normal-case tracking-normal text-hope-700" role="status">
                      {suggestionMessage}
                    </span>
                  ) : null}
                </Field>
                <fieldset className="grid gap-2 md:col-span-2">
                  <legend className="text-xs font-bold uppercase tracking-wide text-ink-500">Funções</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {scheduleMemberRoleOptions.map((role) => (
                      <label key={role.value} className="flex min-h-10 items-center gap-2 rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-700">
                        <input
                          type="checkbox"
                          name="schedule-member-roles"
                          value={role.value}
                          checked={memberForm.roles.includes(role.value)}
                          onChange={(event) => updateRole(role.value, event.target.checked)}
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>
                  {memberForm.roles.length === 0 ? (
                    <span className="text-xs font-semibold text-red-700">Selecione pelo menos uma função.</span>
                  ) : null}
                </fieldset>
                {showInstrumentFields ? (
                  <>
                    <Field label="Categoria musical">
                      <select
                        value={memberForm.instrumentAssignment?.instrumentCategoryId ?? ""}
                        onChange={(event) => updateInstrumentCategory(event.target.value)}
                        disabled={isCategoriesLoading}
                        className={inputClass}
                        aria-busy={isCategoriesLoading}
                      >
                        <option value="">{isCategoriesLoading ? "Carregando categorias..." : "Categoria nao informada"}</option>
                        {categoryOptions.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}{!category.isActive ? " (Inativa)" : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <fieldset className="grid gap-2 text-xs font-bold uppercase tracking-wide text-ink-500">
                      <legend>Origem do instrumento</legend>
                      <label className="flex items-center gap-2 text-sm font-semibold normal-case tracking-normal text-ink-700">
                        <input type="radio" name="instrument-source" value="REGISTERED" checked={memberForm.instrumentAssignment?.source === "REGISTERED"} onChange={() => updateInstrumentSource("REGISTERED")} />
                        Instrumento da igreja
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold normal-case tracking-normal text-ink-700">
                        <input type="radio" name="instrument-source" value="OWN" checked={memberForm.instrumentAssignment?.source === "OWN"} onChange={() => updateInstrumentSource("OWN")} />
                        Instrumento próprio
                      </label>
                    </fieldset>
                    {memberForm.instrumentAssignment?.source === "REGISTERED" ? (
                      <Field label="Instrumento" className="md:col-span-2">
                        <select
                          value={memberForm.instrumentAssignment.instrumentId}
                          onChange={(event) => updateInstrumentId(event.target.value)}
                          disabled={!memberForm.instrumentAssignment.instrumentCategoryId || isInstrumentsLoading}
                          className={inputClass}
                          aria-busy={isInstrumentsLoading}
                        >
                          <option value="">
                            {!memberForm.instrumentAssignment.instrumentCategoryId
                              ? "Selecione uma categoria primeiro"
                              : isInstrumentsLoading
                                ? "Carregando instrumentos..."
                                : instrumentOptions.length === 0
                                  ? "Nenhum instrumento ativo disponivel para esta categoria."
                                  : "Selecione"}
                          </option>
                          {instrumentOptions.map((instrument) => (
                            <option key={instrument.id} value={instrument.id}>
                              {instrumentLabel(instrument, instrument.id === historicalAssignment?.instrument?.id)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                    {memberForm.instrumentAssignment?.source === "OWN" ? (
                      <p className="text-sm font-semibold text-ink-600 md:col-span-2">Será utilizado um instrumento próprio do membro.</p>
                    ) : null}
                  </>
                ) : null}
                <Field label="Status">
                  <select value={memberForm.status} onChange={(event) => updateForm("status", event.target.value as ScheduleMemberStatus)} className={inputClass}>
                    {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </Field>
                <Field label="Substituto">
                  <select value={memberForm.replacedByMemberId ?? ""} onChange={(event) => updateForm("replacedByMemberId", event.target.value)} className={inputClass}>
                    <option value="">Nenhum</option>
                    {selectableMembers.map((member) => <option key={member.id} value={member.id}>{getMemberOptionLabel(member)}</option>)}
                  </select>
                </Field>
                <Field label="Confirmado em" className="md:col-span-2">
                  <input type="datetime-local" value={memberForm.confirmedAt?.slice(0, 16) ?? ""} onChange={(event) => updateForm("confirmedAt", event.target.value ? new Date(event.target.value).toISOString() : "")} className={inputClass} />
                </Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink-700 md:col-span-2">
                  <input type="checkbox" checked={memberForm.allowMinistryException} onChange={(event) => updateAllowMinistryException(event.target.checked)} />
                  Permitir excecao para membro fora do ministerio
                </label>
                <Field label="Observacoes" className="md:col-span-2">
                  <textarea value={memberForm.observations ?? ""} onChange={(event) => updateForm("observations", event.target.value)} className={`${inputClass} min-h-20`} />
                </Field>
              </div>
              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Salvando..." : "Salvar membro"}</button>
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
