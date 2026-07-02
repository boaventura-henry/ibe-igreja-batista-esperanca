"use client";

import { EventStatus, EventType } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { EventFormValues, EventListResult, EventSummary } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const emptyForm: EventFormValues = {
  title: "",
  description: "",
  type: EventType.OTHER,
  status: EventStatus.DRAFT,
  ministryId: "",
  responsibleMemberId: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  startTime: "",
  endTime: "",
  location: "",
  address: "",
  capacity: "",
  requiresRegistration: false,
  isPublic: false,
  imageUrl: "",
  observations: ""
};

const typeLabels: Record<EventType, string> = {
  SERVICE: "Culto",
  CONFERENCE: "Conferencia",
  MEETING: "Reuniao",
  CLASS: "Aula",
  COURSE: "Curso",
  REHEARSAL: "Ensaio",
  VIGIL: "Vigilia",
  RETREAT: "Retiro",
  OUTREACH: "Acao externa",
  OTHER: "Outro"
};

const statusLabels: Record<EventStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  CANCELED: "Cancelado",
  COMPLETED: "Concluido"
};

const sortOptions = [
  { value: "startDate", label: "Data" },
  { value: "title", label: "Titulo" },
  { value: "type", label: "Tipo" },
  { value: "status", label: "Status" },
  { value: "updatedAt", label: "Atualizacao" }
];

function dateForInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function normalizeForm(form: EventFormValues, options: { includeStatus?: boolean } = {}) {
  const payload = {
    title: form.title,
    description: form.description?.trim() || null,
    type: form.type,
    status: options.includeStatus ? form.status : undefined,
    ministryId: form.ministryId || null,
    responsibleMemberId: form.responsibleMemberId || null,
    startDate: form.startDate,
    endDate: form.endDate || null,
    startTime: form.startTime?.trim() || null,
    endTime: form.endTime?.trim() || null,
    location: form.location?.trim() || null,
    address: form.address?.trim() || null,
    capacity: form.capacity === "" ? null : Number(form.capacity),
    requiresRegistration: form.requiresRegistration,
    isPublic: form.isPublic,
    imageUrl: form.imageUrl?.trim() || null,
    observations: form.observations?.trim() || null
  };

  return payload;
}

export function EventManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<EventListResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingEvent, setViewingEvent] = useState<EventSummary | null>(null);
  const [form, setForm] = useState<EventFormValues>(emptyForm);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    status: "",
    ministryId: "",
    startDate: "",
    endDate: "",
    isPublic: "",
    sortBy: "startDate",
    sortDirection: "asc",
    page: "1"
  });

  const permissionCodes = session?.user.permissionCodes ?? [];
  const canCreate = permissionCodes.includes("event.create");
  const canUpdate = permissionCodes.includes("event.update");
  const canDelete = permissionCodes.includes("event.delete");
  const canPublish = permissionCodes.includes("event.publish");
  const canCancel = permissionCodes.includes("event.cancel");
  const canComplete = permissionCodes.includes("event.complete");

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

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/events?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<EventListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar eventos.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadEvents, 250);

    return () => window.clearTimeout(timeout);
  }, [loadEvents]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : "1"
    }));
  }

  function updateForm<K extends keyof EventFormValues>(name: K, value: EventFormValues[K]) {
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setIsFormOpen(true);
  }

  async function openEditForm(id: string) {
    setMessage("");

    try {
      const response = await fetch(`/api/events/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<EventSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      const event = payload.data;
      setEditingId(id);
      setForm({
        title: event.title,
        description: event.description ?? "",
        type: event.type,
        status: event.status,
        ministryId: event.ministry?.id ?? "",
        responsibleMemberId: event.responsibleMember?.id ?? "",
        startDate: dateForInput(event.startDate),
        endDate: dateForInput(event.endDate),
        startTime: event.startTime ?? "",
        endTime: event.endTime ?? "",
        location: event.location ?? "",
        address: event.address ?? "",
        capacity: event.capacity ?? "",
        requiresRegistration: event.requiresRegistration,
        isPublic: event.isPublic,
        imageUrl: event.imageUrl ?? "",
        observations: event.observations ?? ""
      });
      setIsFormOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel abrir o evento.");
    }
  }

  async function openView(id: string) {
    setMessage("");

    try {
      const response = await fetch(`/api/events/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<EventSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setViewingEvent(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel visualizar o evento.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch(editingId ? `/api/events/${editingId}` : "/api/events", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeForm(form, { includeStatus: !editingId }))
      });
      const payload = (await response.json()) as ApiResponse<EventSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setIsFormOpen(false);
      setMessage(editingId ? "Evento atualizado com sucesso." : "Evento criado com sucesso.");
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o evento.");
    }
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    setIsUploadingImage(true);
    setMessage("");

    try {
      const response = await fetch("/api/events/photo", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as ApiResponse<{ url: string }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      updateForm("imageUrl", payload.data.url);
      setMessage("Imagem enviada com sucesso.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function runAction(event: EventSummary, action: "publish" | "cancel" | "complete", successMessage: string) {
    setMessage("");

    try {
      const response = await fetch(`/api/events/${event.id}/${action}`, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<EventSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage(successMessage);
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel concluir a acao.");
    }
  }

  async function handleDelete(event: EventSummary) {
    const confirmed = window.confirm("Deseja remover este evento da listagem?");

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage("Evento removido da listagem.");
      await loadEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel remover o evento.");
    }
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-8">
        <FilterInput label="Pesquisa" value={filters.search} onChange={(value) => updateFilter("search", value)} className="lg:col-span-2" />
        <SelectFilter label="Tipo" value={filters.type} onChange={(value) => updateFilter("type", value)}>
          <option value="">Todos</option>
          {Object.values(EventType).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
        </SelectFilter>
        <SelectFilter label="Status" value={filters.status} onChange={(value) => updateFilter("status", value)}>
          <option value="">Todos</option>
          {Object.values(EventStatus).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </SelectFilter>
        <SelectFilter label="Ministerio" value={filters.ministryId} onChange={(value) => updateFilter("ministryId", value)}>
          <option value="">Todos</option>
          {data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
        </SelectFilter>
        <FilterInput label="Inicio" type="date" value={filters.startDate} onChange={(value) => updateFilter("startDate", value)} />
        <FilterInput label="Fim" type="date" value={filters.endDate} onChange={(value) => updateFilter("endDate", value)} />
        <SelectFilter label="Publico" value={filters.isPublic} onChange={(value) => updateFilter("isPublic", value)}>
          <option value="">Todos</option>
          <option value="true">Sim</option>
          <option value="false">Nao</option>
        </SelectFilter>
        <SelectFilter label="Ordenar" value={filters.sortBy} onChange={(value) => updateFilter("sortBy", value)}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectFilter>
        <SelectFilter label="Direcao" value={filters.sortDirection} onChange={(value) => updateFilter("sortDirection", value)}>
          <option value="asc">Crescente</option>
          <option value="desc">Decrescente</option>
        </SelectFilter>
      </div>

      {message ? <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">{message}</div> : null}

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-hope-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Eventos cadastrados</p>
            <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
          </div>
          {canCreate ? <button type="button" onClick={openCreateForm} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo evento</button> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Ministerio</th>
                <th className="px-4 py-3">Responsavel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>Carregando eventos...</td></tr> : null}
              {!isLoading && data?.events.length === 0 ? <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>Nenhum evento encontrado.</td></tr> : null}
              {data?.events.map((event) => (
                <tr key={event.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-ink-900">{event.title}</p>
                    <p className="text-xs font-semibold text-hope-700">{typeLabels[event.type]}</p>
                    <p className="text-xs text-ink-500">{event.location ?? event.address ?? "Local nao informado"}</p>
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    <p>{formatDate(event.startDate)}{event.endDate ? ` - ${formatDate(event.endDate)}` : ""}</p>
                    <p className="text-xs text-ink-500">{[event.startTime, event.endTime].filter(Boolean).join(" - ") || "Horario nao informado"}</p>
                  </td>
                  <td className="px-4 py-4 text-ink-700">{event.ministry?.name ?? "-"}</td>
                  <td className="px-4 py-4 text-ink-700">{event.responsibleMember?.name ?? "-"}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">{statusLabels[event.status]}</span>
                    <p className="mt-1 text-xs text-ink-500">{event.isPublic ? "Publico" : "Interno"}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <ActionButton onClick={() => openView(event.id)}>Ver</ActionButton>
                      {canUpdate ? <ActionButton onClick={() => openEditForm(event.id)}>Editar</ActionButton> : null}
                      {canPublish && event.status !== EventStatus.PUBLISHED ? <ActionButton onClick={() => runAction(event, "publish", "Evento publicado.")}>Publicar</ActionButton> : null}
                      {canCancel && event.status !== EventStatus.CANCELED ? <ActionButton onClick={() => runAction(event, "cancel", "Evento cancelado.")}>Cancelar</ActionButton> : null}
                      {canComplete && event.status !== EventStatus.COMPLETED ? <ActionButton onClick={() => runAction(event, "complete", "Evento concluido.")}>Concluir</ActionButton> : null}
                      {canDelete ? <ActionButton onClick={() => handleDelete(event)}>Remover</ActionButton> : null}
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
        <EventForm
          data={data}
          editingId={editingId}
          form={form}
          isUploadingImage={isUploadingImage}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          onUpload={uploadImage}
          updateForm={updateForm}
        />
      ) : null}

      {viewingEvent ? <EventDetails event={viewingEvent} onClose={() => setViewingEvent(null)} /> : null}
    </div>
  );
}

const filterLabelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const filterInputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800";
const inputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

function EventForm({
  data,
  editingId,
  form,
  isUploadingImage,
  onClose,
  onSubmit,
  onUpload,
  updateForm
}: {
  data: EventListResult | null;
  editingId: string | null;
  form: EventFormValues;
  isUploadingImage: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpload: (file: File) => Promise<void>;
  updateForm: <K extends keyof EventFormValues>(name: K, value: EventFormValues[K]) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
      <div className="mx-auto max-w-4xl rounded-md bg-white shadow-soft">
        <form onSubmit={onSubmit}>
          <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-ink-900">{editingId ? "Editar evento" : "Novo evento"}</h2>
              <p className="text-sm text-ink-500">Dados, publicacao e agenda do evento.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">Fechar</button>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-4">
            <Field label="Titulo" className="md:col-span-2"><input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} className={inputClass} /></Field>
            <Field label="Tipo"><select value={form.type} onChange={(event) => updateForm("type", event.target.value as EventType)} className={inputClass}>{Object.values(EventType).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></Field>
            <Field label="Status"><select value={form.status} onChange={(event) => updateForm("status", event.target.value as EventStatus)} className={inputClass}>{Object.values(EventStatus).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></Field>
            <Field label="Descricao" className="md:col-span-4"><textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} className={`${inputClass} min-h-20`} /></Field>
            <Field label="Ministerio" className="md:col-span-2"><select value={form.ministryId} onChange={(event) => updateForm("ministryId", event.target.value)} className={inputClass}><option value="">Sem ministerio</option>{data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></Field>
            <Field label="Responsavel" className="md:col-span-2"><select value={form.responsibleMemberId} onChange={(event) => updateForm("responsibleMemberId", event.target.value)} className={inputClass}><option value="">Sem responsavel</option>{data?.filters.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
            <Field label="Data inicial"><input required type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} className={inputClass} /></Field>
            <Field label="Data final"><input type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} className={inputClass} /></Field>
            <Field label="Inicio"><input type="time" value={form.startTime} onChange={(event) => updateForm("startTime", event.target.value)} className={inputClass} /></Field>
            <Field label="Fim"><input type="time" value={form.endTime} onChange={(event) => updateForm("endTime", event.target.value)} className={inputClass} /></Field>
            <Field label="Local" className="md:col-span-2"><input value={form.location} onChange={(event) => updateForm("location", event.target.value)} className={inputClass} /></Field>
            <Field label="Endereco" className="md:col-span-2"><input value={form.address} onChange={(event) => updateForm("address", event.target.value)} className={inputClass} /></Field>
            <Field label="Capacidade"><input type="number" min={1} value={form.capacity} onChange={(event) => updateForm("capacity", event.target.value ? Number(event.target.value) : "")} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm font-bold text-ink-700"><input type="checkbox" checked={form.requiresRegistration} onChange={(event) => updateForm("requiresRegistration", event.target.checked)} /> Exige inscricao</label>
            <label className="flex items-center gap-2 text-sm font-bold text-ink-700"><input type="checkbox" checked={form.isPublic} onChange={(event) => updateForm("isPublic", event.target.checked)} /> Publico no portal</label>
            <Field label="Imagem URL" className="md:col-span-2"><input value={form.imageUrl} onChange={(event) => updateForm("imageUrl", event.target.value)} className={inputClass} /></Field>
            <Field label="Upload" className="md:col-span-2"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={isUploadingImage} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file).catch(() => undefined); }} className={inputClass} /></Field>
            {form.imageUrl ? (
              <div className="md:col-span-4">
                <div className="overflow-hidden rounded-md border border-hope-100 bg-hope-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imageUrl} alt="" className="max-h-56 w-full object-cover" />
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <p className="truncate text-xs font-semibold text-ink-600">{form.imageUrl}</p>
                    <button type="button" onClick={() => updateForm("imageUrl", "")} className="shrink-0 rounded-md border border-hope-100 bg-white px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50">Limpar imagem</button>
                  </div>
                </div>
              </div>
            ) : null}
            <Field label="Observacoes" className="md:col-span-4"><textarea value={form.observations} onChange={(event) => updateForm("observations", event.target.value)} className={`${inputClass} min-h-24`} /></Field>
          </div>

          <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">Cancelar</button>
            <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Salvar evento</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EventDetails({ event, onClose }: { event: EventSummary; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
      <div className="w-full max-w-2xl rounded-md bg-white shadow-soft">
        <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-hope-700">{typeLabels[event.type]}</p>
            <h2 className="text-xl font-bold text-ink-900">{event.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">Fechar</button>
        </div>
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt="" className="max-h-72 w-full object-cover" />
        ) : null}
        <div className="grid gap-4 p-5 text-sm text-ink-700 sm:grid-cols-2">
          <Info label="Status" value={statusLabels[event.status]} />
          <Info label="Publico" value={event.isPublic ? "Sim" : "Nao"} />
          <Info label="Data" value={`${formatDate(event.startDate)}${event.endDate ? ` - ${formatDate(event.endDate)}` : ""}`} />
          <Info label="Horario" value={[event.startTime, event.endTime].filter(Boolean).join(" - ") || "-"} />
          <Info label="Ministerio" value={event.ministry?.name ?? "-"} />
          <Info label="Responsavel" value={event.responsibleMember?.name ?? "-"} />
          <Info label="Local" value={event.location ?? "-"} />
          <Info label="Endereco" value={event.address ?? "-"} />
          <Info label="Capacidade" value={event.capacity ? String(event.capacity) : "-"} />
          <Info label="Inscricao" value={event.requiresRegistration ? "Sim" : "Nao"} />
          <Info label="Descricao" value={event.description ?? "-"} />
          <Info label="Observacoes" value={event.observations ?? "-"} />
        </div>
      </div>
    </div>
  );
}

function FilterInput({ label, type = "text", value, onChange, className = "" }: { label: string; type?: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`${filterLabelClass} ${className}`}>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={filterInputClass} /></label>;
}

function SelectFilter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className={filterLabelClass}>{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={filterInputClass}>{children}</select></label>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 ${className}`}>{label}{children}</label>;
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50">{children}</button>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</p><p className="mt-1 font-semibold text-ink-900">{value}</p></div>;
}
