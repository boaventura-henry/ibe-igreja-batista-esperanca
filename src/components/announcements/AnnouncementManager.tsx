"use client";

import { AnnouncementAudience, AnnouncementStatus } from "@prisma/client";
import { FormMessage } from "@/components/ui/FormMessage";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { AnnouncementFormValues, AnnouncementListResult, AnnouncementSummary } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const emptyForm: AnnouncementFormValues = {
  title: "",
  content: "",
  status: AnnouncementStatus.DRAFT,
  audience: AnnouncementAudience.ALL,
  ministryId: "",
  isPinned: false,
  publishAt: "",
  expiresAt: "",
  externalLink: ""
};

const statusLabels: Record<AnnouncementStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado"
};

const audienceLabels: Record<AnnouncementAudience, string> = {
  ALL: "Todos",
  MINISTRY: "Ministerio",
  PORTAL_ONLY: "Portal"
};

const sortOptions = [
  { value: "createdAt", label: "Criacao" },
  { value: "publishAt", label: "Publicacao" },
  { value: "expiresAt", label: "Expiracao" },
  { value: "title", label: "Titulo" },
  { value: "status", label: "Status" }
];

function dateTimeForInput(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "-";
}

function normalizeForm(form: AnnouncementFormValues, includeStatus: boolean) {
  return {
    title: form.title,
    content: form.content,
    status: includeStatus ? form.status : undefined,
    audience: form.audience,
    ministryId: form.audience === AnnouncementAudience.MINISTRY ? form.ministryId || null : null,
    isPinned: form.isPinned,
    publishAt: dateTimeFromInput(form.publishAt),
    expiresAt: dateTimeFromInput(form.expiresAt),
    externalLink: form.externalLink?.trim() || null
  };
}

function dateTimeFromInput(value: string | undefined) {
  return value ? new Date(value).toISOString() : null;
}

export function AnnouncementManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<AnnouncementListResult | null>(null);
  const [message, setMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AnnouncementSummary | null>(null);
  const [form, setForm] = useState<AnnouncementFormValues>(emptyForm);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    audience: "",
    ministryId: "",
    sortBy: "createdAt",
    sortDirection: "desc",
    page: "1"
  });

  const permissionCodes = session?.user.permissionCodes ?? [];
  const canCreate = permissionCodes.includes("announcement.create");
  const canUpdate = permissionCodes.includes("announcement.update");
  const canDelete = permissionCodes.includes("announcement.delete");
  const canPublish = permissionCodes.includes("announcement.publish");
  const canArchive = permissionCodes.includes("announcement.archive");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("pageSize", "10");
    return params.toString();
  }, [filters]);

  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/announcements?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<AnnouncementListResult>;

      if (!payload.success) throw new Error(payload.error.message);
      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar comunicados.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadAnnouncements, 250);
    return () => window.clearTimeout(timeout);
  }, [loadAnnouncements]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value, page: name === "page" ? value : "1" }));
  }

  function updateForm<K extends keyof AnnouncementFormValues>(name: K, value: AnnouncementFormValues[K]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setFormMessage("");
    setIsFormOpen(true);
  }

  async function openEditForm(id: string) {
    setMessage("");
    setFormMessage("");

    try {
      const response = await fetch(`/api/announcements/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<AnnouncementSummary>;

      if (!payload.success) throw new Error(payload.error.message);
      const announcement = payload.data;

      setEditingId(id);
      setForm({
        title: announcement.title,
        content: announcement.content,
        status: announcement.status,
        audience: announcement.audience,
        ministryId: announcement.ministry?.id ?? "",
        isPinned: announcement.isPinned,
        publishAt: dateTimeForInput(announcement.publishAt),
        expiresAt: dateTimeForInput(announcement.expiresAt),
        externalLink: announcement.externalLink ?? ""
      });
      setIsFormOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel abrir o comunicado.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");

    try {
      const response = await fetch(editingId ? `/api/announcements/${editingId}` : "/api/announcements", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeForm(form, !editingId))
      });
      const payload = (await response.json()) as ApiResponse<AnnouncementSummary>;

      if (!payload.success) throw new Error(payload.error.message);
      setIsFormOpen(false);
      setMessage(editingId ? "Comunicado atualizado com sucesso." : "Comunicado criado com sucesso.");
      await loadAnnouncements();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o comunicado.");
    }
  }

  async function runAction(announcement: AnnouncementSummary, action: "publish" | "archive", successMessage: string) {
    setMessage("");

    try {
      const response = await fetch(`/api/announcements/${announcement.id}/${action}`, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<AnnouncementSummary>;

      if (!payload.success) throw new Error(payload.error.message);
      setMessage(successMessage);
      await loadAnnouncements();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel concluir a acao.");
    }
  }

  async function handleDelete(announcement: AnnouncementSummary) {
    if (!window.confirm("Deseja remover este comunicado da listagem?")) return;

    try {
      const response = await fetch(`/api/announcements/${announcement.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.success) throw new Error(payload.error.message);
      setMessage("Comunicado removido da listagem.");
      await loadAnnouncements();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel remover o comunicado.");
    }
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-7">
        <FilterInput label="Pesquisa" value={filters.search} onChange={(value) => updateFilter("search", value)} className="lg:col-span-2" />
        <SelectFilter label="Status" value={filters.status} onChange={(value) => updateFilter("status", value)}>
          <option value="">Todos</option>
          {Object.values(AnnouncementStatus).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </SelectFilter>
        <SelectFilter label="Publico" value={filters.audience} onChange={(value) => updateFilter("audience", value)}>
          <option value="">Todos</option>
          {Object.values(AnnouncementAudience).map((audience) => <option key={audience} value={audience}>{audienceLabels[audience]}</option>)}
        </SelectFilter>
        <SelectFilter label="Ministerio" value={filters.ministryId} onChange={(value) => updateFilter("ministryId", value)}>
          <option value="">Todos</option>
          {data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
        </SelectFilter>
        <SelectFilter label="Ordenar" value={filters.sortBy} onChange={(value) => updateFilter("sortBy", value)}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectFilter>
        <SelectFilter label="Direcao" value={filters.sortDirection} onChange={(value) => updateFilter("sortDirection", value)}>
          <option value="desc">Decrescente</option>
          <option value="asc">Crescente</option>
        </SelectFilter>
      </div>

      {message ? <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">{message}</div> : null}

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-hope-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Comunicados cadastrados</p>
            <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
          </div>
          {canCreate ? <button type="button" onClick={openCreateForm} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo comunicado</button> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Comunicado</th>
                <th className="px-4 py-3">Publico</th>
                <th className="px-4 py-3">Publicacao</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={5}>Carregando comunicados...</td></tr> : null}
              {!isLoading && data?.announcements.length === 0 ? <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={5}>Nenhum comunicado encontrado.</td></tr> : null}
              {data?.announcements.map((announcement) => (
                <tr key={announcement.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-ink-900">{announcement.title}</p>
                    <p className="line-clamp-2 text-xs text-ink-500">{announcement.content}</p>
                    {announcement.isPinned ? <span className="mt-2 inline-flex rounded-md bg-gold-100 px-2 py-1 text-xs font-bold text-ink-800">Fixado</span> : null}
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    <p>{audienceLabels[announcement.audience]}</p>
                    <p className="text-xs text-ink-500">{announcement.ministry?.name ?? "-"}</p>
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    <p>{formatDate(announcement.publishAt)}</p>
                    <p className="text-xs text-ink-500">Expira: {formatDate(announcement.expiresAt)}</p>
                  </td>
                  <td className="px-4 py-4"><span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">{statusLabels[announcement.status]}</span></td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <ActionButton onClick={() => setViewing(announcement)}>Ver</ActionButton>
                      {canUpdate ? <ActionButton onClick={() => openEditForm(announcement.id)}>Editar</ActionButton> : null}
                      {canPublish && announcement.status !== AnnouncementStatus.PUBLISHED ? <ActionButton onClick={() => runAction(announcement, "publish", "Comunicado publicado.")}>Publicar</ActionButton> : null}
                      {canArchive && announcement.status !== AnnouncementStatus.ARCHIVED ? <ActionButton onClick={() => runAction(announcement, "archive", "Comunicado arquivado.")}>Arquivar</ActionButton> : null}
                      {canDelete ? <ActionButton onClick={() => handleDelete(announcement)}>Remover</ActionButton> : null}
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
        <AnnouncementForm
          data={data}
          editingId={editingId}
          form={form}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          updateForm={updateForm}
          formMessage={formMessage}
        />
      ) : null}

      {viewing ? <AnnouncementDetails announcement={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

const filterLabelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const filterInputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800";
const inputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

function AnnouncementForm({
  data,
  editingId,
  form,
  onClose,
  onSubmit,
  updateForm,
  formMessage
}: {
  data: AnnouncementListResult | null;
  editingId: string | null;
  form: AnnouncementFormValues;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  updateForm: <K extends keyof AnnouncementFormValues>(name: K, value: AnnouncementFormValues[K]) => void;
  formMessage: string;
}) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-md bg-white shadow-soft">
        <form onSubmit={onSubmit}>
          <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-ink-900">{editingId ? "Editar comunicado" : "Novo comunicado"}</h2>
              <p className="text-sm text-ink-500">Conteudo, publico e periodo de exibicao.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">Fechar</button>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-4">
            <div className="md:col-span-4">
              <FormMessage id="announcement-form-message">{formMessage}</FormMessage>
            </div>
            <Field label="Titulo" className="md:col-span-3"><input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} className={inputClass} /></Field>
            <Field label="Status"><select value={form.status} disabled={Boolean(editingId)} onChange={(event) => updateForm("status", event.target.value as AnnouncementStatus)} className={inputClass}>{Object.values(AnnouncementStatus).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></Field>
            <Field label="Conteudo" className="md:col-span-4"><textarea required value={form.content} onChange={(event) => updateForm("content", event.target.value)} className={`${inputClass} min-h-32`} /></Field>
            <Field label="Publico"><select value={form.audience} onChange={(event) => updateForm("audience", event.target.value as AnnouncementAudience)} className={inputClass}>{Object.values(AnnouncementAudience).map((audience) => <option key={audience} value={audience}>{audienceLabels[audience]}</option>)}</select></Field>
            <Field label="Ministerio"><select value={form.ministryId} disabled={form.audience !== AnnouncementAudience.MINISTRY} onChange={(event) => updateForm("ministryId", event.target.value)} className={inputClass}><option value="">Selecione</option>{data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></Field>
            <Field label="Publicar em"><input type="datetime-local" value={form.publishAt} onChange={(event) => updateForm("publishAt", event.target.value)} className={inputClass} /></Field>
            <Field label="Expirar em"><input type="datetime-local" value={form.expiresAt} onChange={(event) => updateForm("expiresAt", event.target.value)} className={inputClass} /></Field>
            <Field label="Link externo" className="md:col-span-3"><input value={form.externalLink} onChange={(event) => updateForm("externalLink", event.target.value)} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm font-bold text-ink-700"><input type="checkbox" checked={form.isPinned} onChange={(event) => updateForm("isPinned", event.target.checked)} /> Fixar comunicado</label>
          </div>

          <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">Cancelar</button>
            <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Salvar comunicado</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AnnouncementDetails({ announcement, onClose }: { announcement: AnnouncementSummary; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
      <div className="w-full max-w-2xl rounded-md bg-white shadow-soft">
        <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-hope-700">{audienceLabels[announcement.audience]}</p>
            <h2 className="text-xl font-bold text-ink-900">{announcement.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">Fechar</button>
        </div>
        <div className="grid gap-4 p-5 text-sm text-ink-700">
          <p className="whitespace-pre-wrap leading-7">{announcement.content}</p>
          {announcement.externalLink ? <a href={announcement.externalLink} target="_blank" rel="noreferrer" className="font-bold text-hope-700 underline">Abrir link externo</a> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Info label="Status" value={statusLabels[announcement.status]} />
            <Info label="Publicacao" value={formatDate(announcement.publishAt)} />
            <Info label="Expiracao" value={formatDate(announcement.expiresAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterInput({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`${filterLabelClass} ${className}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} className={filterInputClass} /></label>;
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
