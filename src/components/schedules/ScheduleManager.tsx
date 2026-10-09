"use client";

import Link from "next/link";
import { ScheduleMemberRole, ScheduleStatus } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ScheduleMemberBasicEditor,
  type ScheduleEligibleInstrumentOption,
  type ScheduleInstrumentCategoryOption,
  type ScheduleInstrumentDraft,
  type ScheduleMemberBasicValue
} from "@/components/schedules/ScheduleMemberBasicEditor";
import { FormMessage } from "@/components/ui/FormMessage";
import { ScheduleMemberNames } from "@/components/schedules/ScheduleMemberNames";
import { applicationDateInputValue } from "@/lib/application-time";
import { getScheduleMemberDisplayRoles, normalizeScheduleMemberRoles } from "@/lib/schedule-member-role";
import type { ScheduleFormValues, ScheduleListItem, ScheduleListResult, ScheduleSummary } from "@/types";
import { formatDateForInput, getMemberOptionLabel } from "@/utils";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

type AvailableScheduleMember = {
  id: string;
  name: string;
  nickname: string | null;
  displayName: string;
  status: string;
};

type InitialTeamDraft = ScheduleMemberBasicValue & {
  key: string;
  allowMinistryException: boolean;
  categoryName?: string;
  instrumentName?: string;
};

const emptyInitialMember = (): InitialTeamDraft => ({
  key: crypto.randomUUID(),
  memberId: "",
  roles: [],
  allowMinistryException: false
});

const statusOptions = [
  { value: ScheduleStatus.DRAFT, label: "Rascunho" },
  { value: ScheduleStatus.PUBLISHED, label: "Publicada" },
  { value: ScheduleStatus.COMPLETED, label: "Concluida" },
  { value: ScheduleStatus.CANCELED, label: "Cancelada" }
];

const sortOptions = [
  { value: "date", label: "Data" },
  { value: "title", label: "Titulo" },
  { value: "status", label: "Status" },
  { value: "updatedAt", label: "Atualizacao" }
];

export function createScheduleForm(now = new Date()): ScheduleFormValues {
  return {
  title: "",
  description: "",
  ministryId: "",
  eventId: "",
  date: applicationDateInputValue(now),
  startTime: "",
  endTime: "",
  location: "",
  observations: ""
  };
}

function statusLabel(status: ScheduleStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function normalizeForm(form: ScheduleFormValues, initialMembers?: InitialTeamDraft[]) {
  return {
    title: form.title,
    description: form.description?.trim() || undefined,
    ministryId: form.ministryId,
    eventId: form.eventId?.trim() || null,
    date: form.date,
    startTime: form.startTime?.trim() || undefined,
    endTime: form.endTime?.trim() || undefined,
    location: form.location?.trim() || undefined,
    observations: form.observations?.trim() || undefined,
    ...(initialMembers
      ? {
          initialMembers: initialMembers.map(({ memberId, roles, allowMinistryException, instrumentAssignment }) => ({
            memberId,
            roles,
            allowMinistryException,
            ...(instrumentAssignment
              ? {
                  instrumentAssignment: {
                    instrumentCategoryId: instrumentAssignment.instrumentCategoryId,
                    source: instrumentAssignment.source,
                    instrumentId: instrumentAssignment.source === "REGISTERED" ? instrumentAssignment.instrumentId : null
                  }
                }
              : {})
          }))
        }
      : {})
  };
}

export function ScheduleManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<ScheduleListResult | null>(null);
  const [message, setMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleFormValues>(() => createScheduleForm());
  const [initialMembers, setInitialMembers] = useState<InitialTeamDraft[]>([]);
  const [isTeamEditorOpen, setIsTeamEditorOpen] = useState(false);
  const [editingTeamKey, setEditingTeamKey] = useState<string | null>(null);
  const [teamDraft, setTeamDraft] = useState<InitialTeamDraft>(emptyInitialMember);
  const [availableMembers, setAvailableMembers] = useState<AvailableScheduleMember[]>([]);
  const [instrumentCategories, setInstrumentCategories] = useState<ScheduleInstrumentCategoryOption[]>([]);
  const [eligibleInstruments, setEligibleInstruments] = useState<ScheduleEligibleInstrumentOption[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [isInstrumentsLoading, setIsInstrumentsLoading] = useState(false);
  const membersRequest = useRef(0);
  const instrumentsRequest = useRef(0);
  const submitLock = useRef(false);
  const [filters, setFilters] = useState({
    search: "",
    ministryId: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    includeCompleted: "",
    sortBy: "date",
    sortOrder: "asc",
    page: "1"
  });

  const permissionCodes = session?.user.permissionCodes ?? [];
  const canCreate = permissionCodes.includes("schedule.create");
  const canUpdate = permissionCodes.includes("schedule.update");
  const canManageInitialTeam = canCreate && canUpdate;
  const canDelete = permissionCodes.includes("schedule.delete");
  const canPublish = permissionCodes.includes("schedule.publish");
  const canCancel = permissionCodes.includes("schedule.cancel");
  const canComplete = permissionCodes.includes("schedule.complete");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    params.set("pageSize", "10");

    return params.toString();
  }, [filters]);

  const selectableInitialMembers = useMemo(() => {
    const selectedIds = new Set(
      initialMembers
        .filter((member) => member.key !== editingTeamKey)
        .map((member) => member.memberId)
    );
    return availableMembers.filter((member) => !selectedIds.has(member.id));
  }, [availableMembers, editingTeamKey, initialMembers]);

  const loadSchedules = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/schedules?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<ScheduleListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar as escalas.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadSchedules, 250);

    return () => window.clearTimeout(timeout);
  }, [loadSchedules]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : "1"
    }));
  }

  function updateForm<K extends keyof ScheduleFormValues>(name: K, value: ScheduleFormValues[K]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(createScheduleForm());
    setInitialMembers([]);
    setIsTeamEditorOpen(false);
    setEditingTeamKey(null);
    setMessage("");
    setFormMessage("");
    setIsFormOpen(true);
  }

  async function openEditForm(schedule: ScheduleListItem) {
    setEditingId(schedule.id);
    setInitialMembers([]);
    setIsTeamEditorOpen(false);
    setForm({
      title: schedule.title,
      description: schedule.description ?? "",
      ministryId: schedule.ministry.id,
      eventId: schedule.event?.id ?? "",
      date: formatDateForInput(schedule.date),
      startTime: schedule.startTime ?? "",
      endTime: schedule.endTime ?? "",
      location: schedule.location ?? "",
      observations: schedule.observations ?? ""
    });
    setMessage("");
    setFormMessage("");
    setIsFormOpen(true);
  }

  function updateMinistry(ministryId: string) {
    membersRequest.current += 1;
    instrumentsRequest.current += 1;
    setAvailableMembers([]);
    setEligibleInstruments([]);
    setIsMembersLoading(false);
    setIsInstrumentsLoading(false);
    if (ministryId !== form.ministryId && (initialMembers.length > 0 || isTeamEditorOpen)) {
      setInitialMembers([]);
      setIsTeamEditorOpen(false);
      setEditingTeamKey(null);
      setFormMessage("A equipe inicial foi limpa porque o ministerio da escala foi alterado.");
    }
    updateForm("ministryId", ministryId);
  }

  async function loadInitialMembers(
    allowMinistryException: boolean,
    selectedMemberId = "",
    ministryId = form.ministryId
  ) {
    const requestId = ++membersRequest.current;
    if (!ministryId) return;
    setIsMembersLoading(true);
    try {
      const params = new URLSearchParams({
        ministryId,
        allowMinistryException: String(allowMinistryException)
      });
      const response = await fetch(`/api/schedules/initial-team/members?${params}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<{ members: AvailableScheduleMember[] }>;
      if (!payload.success) throw new Error(payload.error.message);
      if (requestId !== membersRequest.current) return;
      setAvailableMembers(payload.data.members);
      if (
        selectedMemberId &&
        !allowMinistryException &&
        !payload.data.members.some((member) => member.id === selectedMemberId)
      ) {
        setTeamDraft((current) => ({ ...current, memberId: "" }));
        setFormMessage("O membro selecionado foi removido porque nao pertence ao ministerio da escala.");
      }
    } catch (error) {
      if (requestId === membersRequest.current) {
        setFormMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os membros disponiveis.");
      }
    } finally {
      if (requestId === membersRequest.current) setIsMembersLoading(false);
    }
  }

  async function loadInitialInstrumentCategories() {
    setIsCategoriesLoading(true);
    try {
      const response = await fetch("/api/instrument-categories?isActive=true&pageSize=100", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<{ categories: ScheduleInstrumentCategoryOption[] }>;
      if (!payload.success) throw new Error(payload.error.message);
      setInstrumentCategories(payload.data.categories);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Nao foi possivel carregar as categorias musicais.");
    } finally {
      setIsCategoriesLoading(false);
    }
  }

  async function loadInitialEligibleInstruments(categoryId: string, ministryId = form.ministryId) {
    const requestId = ++instrumentsRequest.current;
    if (!categoryId || !ministryId) {
      setEligibleInstruments([]);
      setIsInstrumentsLoading(false);
      return;
    }
    setIsInstrumentsLoading(true);
    try {
      const params = new URLSearchParams({ ministryId, categoryId });
      const response = await fetch(`/api/schedules/initial-team/instruments?${params}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<{ instruments: ScheduleEligibleInstrumentOption[] }>;
      if (!payload.success) throw new Error(payload.error.message);
      if (requestId !== instrumentsRequest.current) return;
      setEligibleInstruments(payload.data.instruments);
    } catch (error) {
      if (requestId === instrumentsRequest.current) {
        setEligibleInstruments([]);
        setFormMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os instrumentos elegiveis.");
      }
    } finally {
      if (requestId === instrumentsRequest.current) setIsInstrumentsLoading(false);
    }
  }

  function openInitialMemberEditor(member?: InitialTeamDraft) {
    if (!form.ministryId) {
      setFormMessage("Selecione o ministerio antes de montar a equipe inicial.");
      return;
    }
    const next = member ? { ...member } : emptyInitialMember();
    setEditingTeamKey(member?.key ?? null);
    setTeamDraft(next);
    setEligibleInstruments([]);
    setFormMessage("");
    setIsTeamEditorOpen(true);
    void loadInitialMembers(next.allowMinistryException, next.memberId);
    void loadInitialInstrumentCategories();
    if (next.instrumentAssignment?.source === "REGISTERED") {
      void loadInitialEligibleInstruments(next.instrumentAssignment.instrumentCategoryId);
    }
  }

  function updateInitialRole(role: ScheduleMemberRole, checked: boolean) {
    setTeamDraft((current) => ({
      ...current,
      roles: normalizeScheduleMemberRoles(
        checked ? [...current.roles, role] : current.roles.filter((item) => item !== role)
      ),
      ...(!checked && role === ScheduleMemberRole.INSTRUMENT ? { instrumentAssignment: undefined } : {})
    }));
    if (!checked && role === ScheduleMemberRole.INSTRUMENT) setEligibleInstruments([]);
  }

  function updateInitialCategory(instrumentCategoryId: string) {
    const source = teamDraft.instrumentAssignment?.source ?? "";
    setTeamDraft((current) => ({
      ...current,
      categoryName: instrumentCategories.find((item) => item.id === instrumentCategoryId)?.name,
      instrumentName: undefined,
      instrumentAssignment: { instrumentCategoryId, source, instrumentId: "" }
    }));
    setEligibleInstruments([]);
    if (source === "REGISTERED" && instrumentCategoryId) void loadInitialEligibleInstruments(instrumentCategoryId);
  }

  function updateInitialInstrumentSource(source: ScheduleInstrumentDraft["source"]) {
    const instrumentCategoryId = teamDraft.instrumentAssignment?.instrumentCategoryId ?? "";
    setTeamDraft((current) => ({
      ...current,
      instrumentName: undefined,
      instrumentAssignment: { instrumentCategoryId, source, instrumentId: "" }
    }));
    if (source === "REGISTERED" && instrumentCategoryId) {
      void loadInitialEligibleInstruments(instrumentCategoryId);
    } else {
      instrumentsRequest.current += 1;
      setEligibleInstruments([]);
      setIsInstrumentsLoading(false);
    }
  }

  function saveInitialMemberDraft() {
    if (!teamDraft.memberId) return setFormMessage("Selecione um membro.");
    if (!teamDraft.roles.length) return setFormMessage("Informe pelo menos uma funcao.");
    if (initialMembers.some((member) => member.memberId === teamDraft.memberId && member.key !== editingTeamKey)) {
      return setFormMessage("Este membro ja foi adicionado a equipe inicial.");
    }
    let instrumentAssignment = teamDraft.instrumentAssignment;
    if (teamDraft.roles.includes(ScheduleMemberRole.INSTRUMENT)) {
      if (!instrumentAssignment?.instrumentCategoryId) return setFormMessage("Informe a categoria musical.");
      if (!instrumentAssignment.source) return setFormMessage("Informe a origem do instrumento.");
      if (instrumentAssignment.source === "REGISTERED" && !instrumentAssignment.instrumentId) {
        return setFormMessage("Selecione o instrumento da igreja.");
      }
    } else {
      instrumentAssignment = undefined;
    }
    const normalized: InitialTeamDraft = {
      ...teamDraft,
      roles: normalizeScheduleMemberRoles(teamDraft.roles),
      instrumentAssignment
    };
    setInitialMembers((current) =>
      editingTeamKey
        ? current.map((member) => member.key === editingTeamKey ? normalized : member)
        : [...current, normalized]
    );
    setIsTeamEditorOpen(false);
    setEditingTeamKey(null);
    setFormMessage("");
  }

  function removeInitialMember(key: string) {
    setInitialMembers((current) => current.filter((member) => member.key !== key));
    if (editingTeamKey === key) {
      setIsTeamEditorOpen(false);
      setEditingTeamKey(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitLock.current) return;
    submitLock.current = true;
    setIsSubmitting(true);
    setFormMessage("");

    try {
      const response = await fetch(editingId ? `/api/schedules/${editingId}` : "/api/schedules", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeForm(form, editingId ? undefined : initialMembers))
      });
      const payload = (await response.json()) as ApiResponse<ScheduleSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setIsFormOpen(false);
      setMessage(editingId ? "Escala atualizada com sucesso." : "Escala criada com sucesso.");
      await loadSchedules();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Nao foi possivel salvar a escala.");
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  async function postAction(id: string, action: "publish" | "cancel" | "complete", successMessage: string) {
    setMessage("");

    try {
      const response = await fetch(`/api/schedules/${id}/${action}`, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<ScheduleSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage(successMessage);
      await loadSchedules();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel executar a acao.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Deseja remover esta escala da listagem?")) {
      return;
    }

    try {
      const response = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage("Escala removida da listagem.");
      await loadSchedules();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel remover a escala.");
    }
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-6">
        <FilterInput label="Pesquisa" value={filters.search} onChange={(value) => updateFilter("search", value)} className="lg:col-span-2" />
        <label className={filterLabelClass}>
          Ministerio
          <select value={filters.ministryId} onChange={(event) => updateFilter("ministryId", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            {data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
          </select>
        </label>
        <label className={filterLabelClass}>
          Status
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
        <FilterInput label="De" type="date" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
        <FilterInput label="Ate" type="date" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
        <label className={`${filterLabelClass} self-end normal-case`}>
          <span className="flex items-center gap-2 py-2 text-sm font-semibold text-ink-700">
            <input type="checkbox" checked={filters.includeCompleted === "true"} onChange={(event) => updateFilter("includeCompleted", event.target.checked ? "true" : "")} />
            Apresentar todos
          </span>
        </label>
        <label className={filterLabelClass}>
          Ordenar por
          <select value={filters.sortBy} onChange={(event) => updateFilter("sortBy", event.target.value)} className={filterInputClass}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={filterLabelClass}>
          Direcao
          <select value={filters.sortOrder} onChange={(event) => updateFilter("sortOrder", event.target.value)} className={filterInputClass}>
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </select>
        </label>
      </div>

      {message ? <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">{message}</div> : null}

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-hope-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Escalas cadastradas</p>
            <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
          </div>
          {canCreate ? (
            <button type="button" onClick={openCreateForm} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
              Nova escala
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Escala</th>
                <th className="px-4 py-3">Ministerio</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Membros</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? (
                <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>Carregando escalas...</td></tr>
              ) : null}
              {!isLoading && data?.schedules.length === 0 ? (
                <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>Nenhuma escala encontrada.</td></tr>
              ) : null}
              {data?.schedules.map((schedule) => (
                <tr key={schedule.id} className="align-top">
                  <td className="px-4 py-4">
                    <Link href={`/escalas/${schedule.id}`} className="font-semibold text-hope-700 hover:text-hope-900">{schedule.title}</Link>
                    <p className="text-xs text-ink-500">{schedule.location || "-"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded" style={{ backgroundColor: schedule.ministry.color }} />
                      <span className="font-semibold text-ink-900">{schedule.ministry.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-ink-700">{schedule.event?.title ?? "-"}</td>
                  <td className="px-4 py-4 text-ink-700">
                    <p>{formatDate(schedule.date)}</p>
                    <p className="text-xs text-ink-500">{[schedule.startTime, schedule.endTime].filter(Boolean).join(" - ") || "Horario nao informado"}</p>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={schedule.status} /></td>
                  <td className="max-w-xs px-4 py-4 align-top text-ink-700">
                    <ScheduleMemberNames members={schedule.members} memberCount={schedule.memberCount} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/escalas/${schedule.id}`} className={actionClass}>Detalhes</Link>
                      {canUpdate && schedule.status !== ScheduleStatus.COMPLETED && schedule.status !== ScheduleStatus.CANCELED ? <ActionButton onClick={() => openEditForm(schedule)}>Editar</ActionButton> : null}
                      {canPublish && schedule.status === ScheduleStatus.DRAFT ? <ActionButton onClick={() => postAction(schedule.id, "publish", "Escala publicada.")}>Publicar</ActionButton> : null}
                      {canComplete && schedule.status === ScheduleStatus.PUBLISHED ? <ActionButton onClick={() => postAction(schedule.id, "complete", "Escala concluida.")}>Concluir</ActionButton> : null}
                      {canCancel && (schedule.status === ScheduleStatus.DRAFT || schedule.status === ScheduleStatus.PUBLISHED) ? <ActionButton onClick={() => postAction(schedule.id, "cancel", "Escala cancelada.")}>Cancelar</ActionButton> : null}
                      {canDelete && schedule.status !== ScheduleStatus.COMPLETED ? <ActionButton onClick={() => handleDelete(schedule.id)}>Remover</ActionButton> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <div className="flex flex-col gap-3 border-t border-hope-100 px-4 py-3 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between">
            <span>Pagina {pagination.page} de {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter("page", String(pagination.page - 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">Anterior</button>
              <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter("page", String(pagination.page + 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">Proxima</button>
            </div>
          </div>
        ) : null}
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
          <div className="mx-auto max-w-3xl rounded-md bg-white shadow-soft">
            <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
              <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">{editingId ? "Editar escala" : "Nova escala"}</h2>
                  <p className="text-sm text-ink-500">Ministerio, data e local da escala.</p>
                </div>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">Fechar</button>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FormMessage id="schedule-form-message">{formMessage}</FormMessage>
                </div>
                <Field label="Titulo" className="md:col-span-2"><input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} className={inputClass} /></Field>
                <Field label="Ministerio">
                  <select required value={form.ministryId} onChange={(event) => updateMinistry(event.target.value)} className={inputClass}>
                    <option value="">Selecione</option>
                    {data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
                  </select>
                </Field>
                <Field label="Evento relacionado">
                  <select value={form.eventId ?? ""} onChange={(event) => updateForm("eventId", event.target.value)} className={inputClass}>
                    <option value="">Nenhum</option>
                    {data?.filters.events
                      .filter((event) => !event.ministryId || event.ministryId === form.ministryId)
                      .map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title} - {formatDate(event.startDate)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Data"><input required type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} className={inputClass} /></Field>
                <Field label="Local"><input value={form.location ?? ""} onChange={(event) => updateForm("location", event.target.value)} className={inputClass} /></Field>
                <Field label="Inicio"><input type="time" value={form.startTime ?? ""} onChange={(event) => updateForm("startTime", event.target.value)} className={inputClass} /></Field>
                <Field label="Fim"><input type="time" value={form.endTime ?? ""} onChange={(event) => updateForm("endTime", event.target.value)} className={inputClass} /></Field>
                <Field label="Descricao" className="md:col-span-2"><textarea value={form.description ?? ""} onChange={(event) => updateForm("description", event.target.value)} className={`${inputClass} min-h-20`} /></Field>
                <Field label="Observacoes" className="md:col-span-2"><textarea value={form.observations ?? ""} onChange={(event) => updateForm("observations", event.target.value)} className={`${inputClass} min-h-20`} /></Field>
                {!editingId && canManageInitialTeam ? (
                  <section className="grid min-w-0 gap-4 border-t border-hope-100 pt-4 md:col-span-2" aria-labelledby="initial-team-title">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 id="initial-team-title" className="text-sm font-bold text-ink-900">Equipe da escala</h3>
                        <p className="text-xs text-ink-500">Opcional. Os participantes serao salvos junto com a escala.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openInitialMemberEditor()}
                        disabled={isSubmitting || !form.ministryId}
                        className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        + Adicionar membro
                      </button>
                    </div>

                    {initialMembers.length ? (
                      <ul className="divide-y divide-hope-100 border-y border-hope-100">
                        {initialMembers.map((member) => {
                          const option = data?.filters.members.find((item) => item.id === member.memberId);
                          const roleLabel = getScheduleMemberDisplayRoles(
                            member,
                            member.categoryName
                              ? { instrumentCategory: { name: member.categoryName } }
                              : null
                          );
                          return (
                            <li key={member.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-bold text-ink-900">
                                  {option ? getMemberOptionLabel(option) : "Membro selecionado"}
                                </p>
                                <p className="break-words text-xs font-semibold text-ink-600">{roleLabel}</p>
                                {member.instrumentAssignment?.source === "REGISTERED" && member.instrumentName ? (
                                  <p className="break-words text-xs text-ink-500">{member.instrumentName}</p>
                                ) : null}
                                {member.instrumentAssignment?.source === "OWN" ? (
                                  <p className="text-xs text-ink-500">Instrumento proprio</p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button type="button" onClick={() => openInitialMemberEditor(member)} className={actionClass}>Editar</button>
                                <button type="button" onClick={() => removeInitialMember(member.key)} className={`${actionClass} text-red-700`}>Remover</button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink-500">Nenhum membro adicionado.</p>
                    )}

                    {isTeamEditorOpen ? (
                      <div className="grid min-w-0 gap-4 border-t border-hope-100 pt-4">
                        <h4 className="text-sm font-bold text-ink-900">{editingTeamKey ? "Editar membro da equipe" : "Adicionar membro a equipe"}</h4>
                        <ScheduleMemberBasicEditor
                          value={teamDraft}
                          members={selectableInitialMembers}
                          categories={instrumentCategories}
                          instruments={eligibleInstruments}
                          onMemberChange={(memberId) => setTeamDraft((current) => ({ ...current, memberId }))}
                          onRoleChange={updateInitialRole}
                          onInstrumentCategoryChange={updateInitialCategory}
                          onInstrumentSourceChange={updateInitialInstrumentSource}
                          onInstrumentChange={(instrumentId) => setTeamDraft((current) => ({
                            ...current,
                            instrumentName: eligibleInstruments.find((item) => item.id === instrumentId)?.name,
                            instrumentAssignment: {
                              instrumentCategoryId: current.instrumentAssignment?.instrumentCategoryId ?? "",
                              source: current.instrumentAssignment?.source ?? "",
                              instrumentId
                            }
                          }))}
                          memberLoading={isMembersLoading}
                          categoriesLoading={isCategoriesLoading}
                          instrumentsLoading={isInstrumentsLoading}
                          instrumentSourceName={`initial-team-instrument-source-${teamDraft.key}`}
                          memberHelp={!teamDraft.allowMinistryException && availableMembers.length === 0 ? (
                            <span className="text-xs font-semibold normal-case tracking-normal text-ink-500">Nao ha membros ativos vinculados a este ministerio.</span>
                          ) : null}
                        />
                        <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                          <input
                            type="checkbox"
                            checked={teamDraft.allowMinistryException}
                            onChange={(event) => {
                              const allow = event.target.checked;
                              const selectedMemberId = teamDraft.memberId;
                              setTeamDraft((current) => ({ ...current, allowMinistryException: allow }));
                              void loadInitialMembers(allow, selectedMemberId);
                            }}
                          />
                          Permitir excecao para membro fora do ministerio
                        </label>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <button type="button" onClick={() => { setIsTeamEditorOpen(false); setEditingTeamKey(null); }} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">Cancelar</button>
                          <button type="button" onClick={saveInitialMemberDraft} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">{editingTeamKey ? "Atualizar membro" : "Adicionar a equipe"}</button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" disabled={isSubmitting} onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700 disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSubmitting || isTeamEditorOpen} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Salvando..." : "Salvar escala"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const filterLabelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const filterInputClass = "rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800";
const inputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100 disabled:bg-ink-50 disabled:text-ink-400";
const actionClass = "rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50";

function StatusBadge({ status }: { status: ScheduleStatus }) {
  return <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">{statusLabel(status)}</span>;
}

function FilterInput({ label, type = "text", value, onChange, className = "" }: { label: string; type?: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={`${filterLabelClass} ${className}`}>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={filterInputClass} />
    </label>
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
