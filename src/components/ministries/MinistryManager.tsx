"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { MinistryIcon, WeekDay } from "@prisma/client";
import type { MinistryFormValues, MinistryListResult, MinistrySummary } from "@/types";
import { formatPhone, onlyDigits } from "@/utils";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const emptyForm: MinistryFormValues = {
  name: "",
  description: "",
  color: "#2563eb",
  icon: MinistryIcon.USERS,
  imageUrl: "",
  displayOrder: 0,
  email: "",
  phone: "",
  meetingDay: "",
  meetingTime: "",
  location: "",
  notes: "",
  isActive: true,
  leaderMemberId: "",
  viceLeaderMemberId: ""
};

const dayOptions = [
  { value: WeekDay.SUNDAY, label: "Domingo" },
  { value: WeekDay.MONDAY, label: "Segunda-feira" },
  { value: WeekDay.TUESDAY, label: "Terca-feira" },
  { value: WeekDay.WEDNESDAY, label: "Quarta-feira" },
  { value: WeekDay.THURSDAY, label: "Quinta-feira" },
  { value: WeekDay.FRIDAY, label: "Sexta-feira" },
  { value: WeekDay.SATURDAY, label: "Sabado" }
];

const iconOptions = [
  MinistryIcon.USERS,
  MinistryIcon.MUSIC,
  MinistryIcon.CHILDREN,
  MinistryIcon.CAMERA,
  MinistryIcon.HEART,
  MinistryIcon.CROSS,
  MinistryIcon.BOOK,
  MinistryIcon.CHURCH,
  MinistryIcon.MIC,
  MinistryIcon.HOME
];

const sortOptions = [
  { value: "displayOrder", label: "Ordem" },
  { value: "name", label: "Nome" },
  { value: "meetingDay", label: "Dia" },
  { value: "updatedAt", label: "Atualizacao" }
];

function normalizeForm(form: MinistryFormValues) {
  return {
    ...form,
    displayOrder: Number(form.displayOrder) || 0,
    email: form.email?.trim() || null,
    phone: form.phone ? onlyDigits(form.phone) : null,
    imageUrl: form.imageUrl?.trim() || null,
    description: form.description?.trim() || null,
    meetingDay: form.meetingDay || null,
    meetingTime: form.meetingTime?.trim() || null,
    location: form.location?.trim() || null,
    notes: form.notes?.trim() || null,
    leaderMemberId: form.leaderMemberId || null,
    viceLeaderMemberId: form.viceLeaderMemberId || null
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusLabel(ministry: MinistrySummary) {
  if (!ministry.isActive) {
    return "Inativo";
  }

  return "Ativo";
}

export function MinistryManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<MinistryListResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingMinistry, setViewingMinistry] = useState<MinistrySummary | null>(null);
  const [form, setForm] = useState<MinistryFormValues>(emptyForm);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    leaderMemberId: "",
    sortBy: "displayOrder",
    sortOrder: "asc",
    page: "1"
  });

  const permissionCodes = session?.user.permissionCodes ?? [];
  const canCreate = permissionCodes.includes("ministry.create");
  const canUpdate = permissionCodes.includes("ministry.update");
  const canDelete = permissionCodes.includes("ministry.delete");

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

  const loadMinistries = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/ministries?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<MinistryListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar ministerios.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadMinistries, 250);

    return () => window.clearTimeout(timeout);
  }, [loadMinistries]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : "1"
    }));
  }

  function updateForm<K extends keyof MinistryFormValues>(name: K, value: MinistryFormValues[K]) {
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
      const response = await fetch(`/api/ministries/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<MinistrySummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      const ministry = payload.data;
      setEditingId(id);
      setForm({
        name: ministry.name,
        description: ministry.description ?? "",
        color: ministry.color,
        icon: ministry.icon,
        imageUrl: ministry.imageUrl ?? "",
        displayOrder: ministry.displayOrder,
        email: ministry.email ?? "",
        phone: formatPhone(ministry.phone),
        meetingDay: ministry.meetingDay ?? "",
        meetingTime: ministry.meetingTime ?? "",
        location: ministry.location ?? "",
        notes: ministry.notes ?? "",
        isActive: ministry.isActive,
        leaderMemberId: ministry.leaderMember?.id ?? "",
        viceLeaderMemberId: ministry.viceLeaderMember?.id ?? ""
      });
      setIsFormOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel abrir o ministerio.");
    }
  }

  async function openView(id: string) {
    setMessage("");

    try {
      const response = await fetch(`/api/ministries/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<MinistrySummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setViewingMinistry(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel visualizar o ministerio.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch(editingId ? `/api/ministries/${editingId}` : "/api/ministries", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeForm(form))
      });
      const payload = (await response.json()) as ApiResponse<MinistrySummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setIsFormOpen(false);
      setMessage(editingId ? "Ministerio atualizado com sucesso." : "Ministerio criado com sucesso.");
      await loadMinistries();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o ministerio.");
    }
  }

  async function handleDelete(ministry: MinistrySummary) {
    const confirmed = window.confirm("Deseja remover este ministerio da listagem?");

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/ministries/${ministry.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage("Ministerio removido da listagem.");
      await loadMinistries();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel remover o ministerio.");
    }
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-6">
        <FilterInput
          label="Pesquisa"
          value={filters.search}
          onChange={(value) => updateFilter("search", value)}
          className="lg:col-span-2"
        />
        <label className={filterLabelClass}>
          Status
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </label>
        <label className={filterLabelClass}>
          Lideranca
          <select value={filters.leaderMemberId} onChange={(event) => updateFilter("leaderMemberId", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            {data?.filters.members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          Ordenar por
          <select value={filters.sortBy} onChange={(event) => updateFilter("sortBy", event.target.value)} className={filterInputClass}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
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

      {message ? (
        <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">
          {message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-hope-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Ministerios cadastrados</p>
            <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
          </div>
          {canCreate ? (
            <button type="button" onClick={openCreateForm} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
              Novo ministerio
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Ministerio</th>
                <th className="px-4 py-3">Lideranca</th>
                <th className="px-4 py-3">Reuniao</th>
                <th className="px-4 py-3">Contatos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ordem</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>
                    Carregando ministerios...
                  </td>
                </tr>
              ) : null}

              {!isLoading && data?.ministries.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>
                    Nenhum ministerio encontrado.
                  </td>
                </tr>
              ) : null}

              {data?.ministries.map((ministry) => (
                <tr key={ministry.id} className="align-top">
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-4 w-4 rounded" style={{ backgroundColor: ministry.color }} />
                      <div>
                        <p className="font-semibold text-ink-900">{ministry.name}</p>
                        <p className="text-xs text-ink-500">{ministry.description || "Sem descricao"}</p>
                        <p className="mt-1 text-xs font-semibold text-ink-500">
                          {ministry.membersCount} membro(s) - {ministry.eventsCount} evento(s)
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    <p>{ministry.leaderMember?.name ?? "-"}</p>
                    <p className="text-xs text-ink-500">{ministry.viceLeaderMember?.name ? `Vice: ${ministry.viceLeaderMember.name}` : ""}</p>
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    {[ministry.meetingDay, ministry.meetingTime].filter(Boolean).join(" - ") || "-"}
                    <p className="text-xs text-ink-500">{ministry.location ?? ""}</p>
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    <p>{ministry.email ?? "-"}</p>
                    <p className="text-xs text-ink-500">{formatPhone(ministry.phone) || ""}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">
                      {statusLabel(ministry)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-ink-700">{ministry.displayOrder}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <ActionButton onClick={() => openView(ministry.id)}>Ver</ActionButton>
                      {canUpdate ? <ActionButton onClick={() => openEditForm(ministry.id)}>Editar</ActionButton> : null}
                      {canDelete ? (
                        <ActionButton onClick={() => handleDelete(ministry)} disabled={ministry.isSystem}>
                          Remover
                        </ActionButton>
                      ) : null}
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
              <button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter("page", String(pagination.page - 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">
                Anterior
              </button>
              <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter("page", String(pagination.page + 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">
                Proxima
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
          <div className="mx-auto max-w-4xl rounded-md bg-white shadow-soft">
            <form onSubmit={handleSubmit}>
              <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">{editingId ? "Editar ministerio" : "Novo ministerio"}</h2>
                  <p className="text-sm text-ink-500">Dados, lideranca, contatos e agenda.</p>
                </div>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">
                  Fechar
                </button>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-4">
                <Field label="Nome" className="md:col-span-2">
                  <input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Cor">
                  <input type="color" value={form.color} onChange={(event) => updateForm("color", event.target.value)} className={`${inputClass} h-10`} />
                </Field>
                <Field label="Icone">
                  <select value={form.icon} onChange={(event) => updateForm("icon", event.target.value as MinistryIcon)} className={inputClass}>
                    {iconOptions.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                  </select>
                </Field>
                <Field label="Descricao" className="md:col-span-4">
                  <textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} className={`${inputClass} min-h-20`} />
                </Field>
                <Field label="Imagem URL" className="md:col-span-2">
                  <input value={form.imageUrl} onChange={(event) => updateForm("imageUrl", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Ordem">
                  <input type="number" min={0} value={form.displayOrder} onChange={(event) => updateForm("displayOrder", Number(event.target.value))} className={inputClass} />
                </Field>
                <label className="flex items-center gap-2 text-sm font-bold text-ink-700">
                  <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm("isActive", event.target.checked)} />
                  Ministerio ativo
                </label>
                <Field label="E-mail" className="md:col-span-2">
                  <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Telefone">
                  <input value={form.phone} onChange={(event) => updateForm("phone", formatPhone(event.target.value))} className={inputClass} />
                </Field>
                <Field label="Dia da reuniao">
                  <select value={form.meetingDay} onChange={(event) => updateForm("meetingDay", event.target.value as WeekDay | "")} className={inputClass}>
                    <option value="">Selecione</option>
                    {dayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                  </select>
                </Field>
                <Field label="Horario">
                  <input type="time" value={form.meetingTime} onChange={(event) => updateForm("meetingTime", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Local" className="md:col-span-3">
                  <input value={form.location} onChange={(event) => updateForm("location", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Lider" className="md:col-span-2">
                  <select value={form.leaderMemberId} onChange={(event) => updateForm("leaderMemberId", event.target.value)} className={inputClass}>
                    <option value="">Sem lider</option>
                    {data?.filters.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </Field>
                <Field label="Vice-lider" className="md:col-span-2">
                  <select value={form.viceLeaderMemberId} onChange={(event) => updateForm("viceLeaderMemberId", event.target.value)} className={inputClass}>
                    <option value="">Sem vice-lider</option>
                    {data?.filters.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </Field>
                <Field label="Observacoes" className="md:col-span-4">
                  <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} className={`${inputClass} min-h-24`} />
                </Field>
              </div>

              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
                  Salvar ministerio
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewingMinistry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="w-full max-w-2xl rounded-md bg-white shadow-soft">
            <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-hope-700">Ministerio</p>
                <h2 className="text-xl font-bold text-ink-900">{viewingMinistry.name}</h2>
              </div>
              <button type="button" onClick={() => setViewingMinistry(null)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">
                Fechar
              </button>
            </div>
            <div className="grid gap-4 p-5 text-sm text-ink-700 sm:grid-cols-2">
              <Info label="Descricao" value={viewingMinistry.description ?? "-"} />
              <Info label="Status" value={statusLabel(viewingMinistry)} />
              <Info label="Lider" value={viewingMinistry.leaderMember?.name ?? "-"} />
              <Info label="Vice-lider" value={viewingMinistry.viceLeaderMember?.name ?? "-"} />
              <Info label="Reuniao" value={[viewingMinistry.meetingDay, viewingMinistry.meetingTime].filter(Boolean).join(" - ") || "-"} />
              <Info label="Local" value={viewingMinistry.location ?? "-"} />
              <Info label="E-mail" value={viewingMinistry.email ?? "-"} />
              <Info label="Telefone" value={formatPhone(viewingMinistry.phone) || "-"} />
              <Info label="Membros" value={String(viewingMinistry.membersCount)} />
              <Info label="Eventos" value={String(viewingMinistry.eventsCount)} />
              <Info label="Atualizado em" value={formatDate(viewingMinistry.updatedAt)} />
              <Info label="Sistema" value={viewingMinistry.isSystem ? "Sim" : "Nao"} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const filterLabelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const filterInputClass =
  "rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800";
const inputClass =
  "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

function FilterInput({
  label,
  value,
  onChange,
  className = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`${filterLabelClass} ${className}`}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className={filterInputClass} />
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

function ActionButton({
  children,
  onClick,
  disabled = false
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 font-semibold text-ink-900">{value}</p>
    </div>
  );
}
