"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { MemberFormValues, MemberListResult } from "@/types";
import { formatCep, formatCpf, formatDateForInput, formatPhone, onlyDigits } from "@/utils";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

type MemberDetail = MemberFormValues & {
  id: string;
  createdAt: string;
  updatedAt: string;
  ministries: Array<{ id: string; name: string }>;
};

const statusOptions = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "INACTIVE", label: "Inativo" },
  { value: "VISITOR", label: "Visitante" },
  { value: "TRANSFERRED", label: "Transferido" },
  { value: "DECEASED", label: "Falecido" }
];

const sexOptions = [
  { value: "NOT_INFORMED", label: "Nao informado" },
  { value: "FEMALE", label: "Feminino" },
  { value: "MALE", label: "Masculino" },
  { value: "OTHER", label: "Outro" }
];

const sortOptions = [
  { value: "name", label: "Nome" },
  { value: "city", label: "Cidade" },
  { value: "status", label: "Situacao" },
  { value: "joinedAt", label: "Ingresso" },
  { value: "updatedAt", label: "Atualizacao" }
];

const emptyForm: MemberFormValues = {
  name: "",
  cpf: "",
  rg: "",
  birthDate: "",
  sex: "NOT_INFORMED",
  maritalStatus: "",
  phone: "",
  mobilePhone: "",
  whatsapp: "",
  email: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  baptismDate: "",
  joinedAt: "",
  status: "ACTIVE",
  notes: "",
  photoUrl: "",
  ministryIds: []
};

function statusLabel(status: string) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function normalizeForm(data: MemberFormValues) {
  return {
    ...data,
    cpf: onlyDigits(data.cpf),
    phone: onlyDigits(data.phone),
    mobilePhone: onlyDigits(data.mobilePhone),
    whatsapp: onlyDigits(data.whatsapp),
    zipCode: onlyDigits(data.zipCode),
    email: data.email?.trim() || undefined
  };
}

export function MemberManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<MemberListResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberFormValues>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    name: "",
    cpf: "",
    city: "",
    status: "",
    ministryId: "",
    sortBy: "name",
    sortOrder: "asc",
    page: "1"
  });

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

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/members?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<MemberListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os membros.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadMembers, 250);

    return () => window.clearTimeout(timeout);
  }, [loadMembers]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : "1"
    }));
  }

  function updateForm<K extends keyof MemberFormValues>(name: K, value: MemberFormValues[K]) {
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
      const response = await fetch(`/api/members/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<MemberDetail>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      const member = payload.data;

      setEditingId(id);
      setForm({
        name: member.name ?? "",
        cpf: formatCpf(member.cpf),
        rg: member.rg ?? "",
        birthDate: formatDateForInput(member.birthDate),
        sex: member.sex ?? "NOT_INFORMED",
        maritalStatus: member.maritalStatus ?? "",
        phone: formatPhone(member.phone),
        mobilePhone: formatPhone(member.mobilePhone),
        whatsapp: formatPhone(member.whatsapp),
        email: member.email ?? "",
        zipCode: formatCep(member.zipCode),
        street: member.street ?? "",
        number: member.number ?? "",
        complement: member.complement ?? "",
        district: member.district ?? "",
        city: member.city ?? "",
        state: member.state ?? "",
        baptismDate: formatDateForInput(member.baptismDate),
        joinedAt: formatDateForInput(member.joinedAt),
        status: member.status ?? "ACTIVE",
        notes: member.notes ?? "",
        photoUrl: member.photoUrl ?? "",
        ministryIds: member.ministries.map((ministry) => ministry.id)
      });
      setIsFormOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel abrir o cadastro.");
    }
  }

  async function handleZipCodeBlur() {
    const zipCode = onlyDigits(form.zipCode);

    if (zipCode.length !== 8) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel buscar o endereco pelo CEP agora.");
      }

      const address = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };

      if (address.erro) {
        setMessage("CEP nao encontrado.");
        return;
      }

      setMessage("");
      setForm((current) => ({
        ...current,
        street: address.logradouro ?? current.street,
        district: address.bairro ?? current.district,
        city: address.localidade ?? current.city,
        state: address.uf ?? current.state
      }));
    } catch (error) {
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "Tempo esgotado ao buscar o CEP."
          : "Nao foi possivel buscar o endereco pelo CEP agora."
      );
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function uploadPhoto(file: File) {
    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch("/api/members/photo", {
      method: "POST",
      body: formData
    });
    const payload = (await response.json()) as ApiResponse<{ url: string }>;

    if (!payload.success) {
      throw new Error(payload.error.message);
    }

    updateForm("photoUrl", payload.data.url);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(editingId ? `/api/members/${editingId}` : "/api/members", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(normalizeForm(form))
      });
      const payload = (await response.json()) as ApiResponse<MemberDetail>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setIsFormOpen(false);
      setMessage(editingId ? "Cadastro atualizado com sucesso." : "Membro cadastrado com sucesso.");
      await loadMembers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o membro.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Deseja inativar este cadastro da listagem?");

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/members/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage("Membro removido da listagem.");
      await loadMembers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel remover o membro.");
    }
  }

  const pagination = data?.pagination;
  const canRemoveMember = session?.user.role === "ADMIN";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-6">
        <FilterInput
          label="Pesquisa"
          value={filters.search}
          onChange={(value) => updateFilter("search", value)}
          className="lg:col-span-2"
        />
        <FilterInput label="Nome" value={filters.name} onChange={(value) => updateFilter("name", value)} />
        <FilterInput
          label="CPF"
          value={formatCpf(filters.cpf)}
          onChange={(value) => updateFilter("cpf", onlyDigits(value))}
        />
        <FilterInput label="Cidade" value={filters.city} onChange={(value) => updateFilter("city", value)} />
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
          Situacao
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
            className="rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800"
          >
            <option value="">Todas</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 lg:col-span-2">
          Ministerio
          <select
            value={filters.ministryId}
            onChange={(event) => updateFilter("ministryId", event.target.value)}
            className="rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800"
          >
            <option value="">Todos</option>
            {data?.filters.ministries.map((ministry) => (
              <option key={ministry.id} value={ministry.id}>
                {ministry.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
          Ordenar por
          <select
            value={filters.sortBy}
            onChange={(event) => updateFilter("sortBy", event.target.value)}
            className="rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
          Direcao
          <select
            value={filters.sortOrder}
            onChange={(event) => updateFilter("sortOrder", event.target.value)}
            className="rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800"
          >
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
            <p className="text-sm font-bold text-ink-900">Cadastro de membros</p>
            <p className="text-xs text-ink-500">
              {pagination ? `${pagination.total} registro(s) encontrados` : "Carregando registros"}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white"
          >
            Novo membro
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Situacao</th>
                <th className="px-4 py-3">Ministerios</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>
                    Carregando membros...
                  </td>
                </tr>
              ) : null}

              {!isLoading && data?.members.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>
                    Nenhum membro encontrado.
                  </td>
                </tr>
              ) : null}

              {data?.members.map((member) => (
                <tr key={member.id} className="align-top">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <MemberAvatar name={member.name} photoUrl={member.photoUrl} />
                      <div>
                        <Link href={`/membros/${member.id}`} className="font-semibold text-ink-900 hover:text-hope-700">
                          {member.name}
                        </Link>
                        <p className="text-xs text-ink-500">{member.email || "Sem e-mail"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-ink-700">{formatCpf(member.cpf) || "-"}</td>
                  <td className="px-4 py-4 text-ink-700">
                    {formatPhone(member.mobilePhone || member.phone) || "-"}
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    {[member.city, member.state].filter(Boolean).join(" - ") || "-"}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">
                      {statusLabel(member.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    {member.ministries.map((ministry) => ministry.name).join(", ") || "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(member.id)}
                        className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50"
                      >
                        Editar
                      </button>
                      {canRemoveMember ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(member.id)}
                          className="rounded-md border border-red-100 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          Remover
                        </button>
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
            <span>
              Pagina {pagination.page} de {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => updateFilter("page", String(pagination.page - 1))}
                className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateFilter("page", String(pagination.page + 1))}
                className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
          <div className="mx-auto max-w-5xl rounded-md bg-white shadow-soft">
            <form onSubmit={handleSubmit}>
              <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">
                    {editingId ? "Editar membro" : "Novo membro"}
                  </h2>
                  <p className="text-sm text-ink-500">Dados pessoais, contato, endereco e vinculos.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700"
                >
                  Fechar
                </button>
              </div>

              <div className="grid gap-5 p-5">
                <section className="grid gap-3 md:grid-cols-4">
                  <Field label="Nome completo" className="md:col-span-2">
                    <input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="CPF">
                    <input required value={form.cpf} onChange={(event) => updateForm("cpf", formatCpf(event.target.value))} className={inputClass} />
                  </Field>
                  <Field label="RG">
                    <input value={form.rg} onChange={(event) => updateForm("rg", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Nascimento">
                    <input type="date" value={form.birthDate} onChange={(event) => updateForm("birthDate", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Sexo">
                    <select value={form.sex} onChange={(event) => updateForm("sex", event.target.value as MemberFormValues["sex"])} className={inputClass}>
                      {sexOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Estado civil">
                    <input value={form.maritalStatus} onChange={(event) => updateForm("maritalStatus", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Situacao">
                    <select value={form.status} onChange={(event) => updateForm("status", event.target.value as MemberFormValues["status"])} className={inputClass}>
                      {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </Field>
                </section>

                <section className="grid gap-3 md:grid-cols-4">
                  <Field label="Telefone">
                    <input value={form.phone} onChange={(event) => updateForm("phone", formatPhone(event.target.value))} className={inputClass} />
                  </Field>
                  <Field label="Celular">
                    <input value={form.mobilePhone} onChange={(event) => updateForm("mobilePhone", formatPhone(event.target.value))} className={inputClass} />
                  </Field>
                  <Field label="WhatsApp">
                    <input value={form.whatsapp} onChange={(event) => updateForm("whatsapp", formatPhone(event.target.value))} className={inputClass} />
                  </Field>
                  <Field label="E-mail">
                    <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} className={inputClass} />
                  </Field>
                </section>

                <section className="grid gap-3 md:grid-cols-6">
                  <Field label="CEP">
                    <input value={form.zipCode} onBlur={handleZipCodeBlur} onChange={(event) => updateForm("zipCode", formatCep(event.target.value))} className={inputClass} />
                  </Field>
                  <Field label="Logradouro" className="md:col-span-3">
                    <input value={form.street} onChange={(event) => updateForm("street", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Numero">
                    <input value={form.number} onChange={(event) => updateForm("number", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Complemento">
                    <input value={form.complement} onChange={(event) => updateForm("complement", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Bairro" className="md:col-span-2">
                    <input value={form.district} onChange={(event) => updateForm("district", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Cidade" className="md:col-span-3">
                    <input value={form.city} onChange={(event) => updateForm("city", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Estado">
                    <input maxLength={2} value={form.state} onChange={(event) => updateForm("state", event.target.value.toUpperCase())} className={inputClass} />
                  </Field>
                </section>

                <section className="grid gap-3 md:grid-cols-4">
                  <Field label="Data de batismo">
                    <input type="date" value={form.baptismDate} onChange={(event) => updateForm("baptismDate", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Data de ingresso">
                    <input type="date" value={form.joinedAt} onChange={(event) => updateForm("joinedAt", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Foto do membro" className="md:col-span-2">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          uploadPhoto(file).catch((error: unknown) => {
                            setMessage(error instanceof Error ? error.message : "Nao foi possivel enviar a foto.");
                          });
                        }
                      }}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Ministerios" className="md:col-span-2">
                    <select
                      multiple
                      value={form.ministryIds}
                      onChange={(event) =>
                        updateForm(
                          "ministryIds",
                          Array.from(event.target.selectedOptions).map((option) => option.value)
                        )
                      }
                      className={`${inputClass} min-h-28`}
                    >
                      {data?.filters.ministries.map((ministry) => (
                        <option key={ministry.id} value={ministry.id}>
                          {ministry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="URL da foto" className="md:col-span-2">
                    <input value={form.photoUrl} onChange={(event) => updateForm("photoUrl", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Observacoes" className="md:col-span-4">
                    <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} className={`${inputClass} min-h-28`} />
                  </Field>
                </section>
              </div>

              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {isSaving ? "Salvando..." : "Salvar membro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
    <label className={`grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 ${className}`}>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800"
      />
    </label>
  );
}

function Field({
  label,
  children,
  className = ""
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function MemberAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" className="h-11 w-11 rounded-md object-cover" />
    );
  }

  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-hope-100 text-sm font-bold text-hope-700">
      {name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
