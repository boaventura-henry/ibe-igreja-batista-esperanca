"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VisitorStatusBadge } from "@/components/visitors/VisitorStatusBadge";
import { formatPhone } from "@/utils";

type Status = "ACTIVE" | "INACTIVE" | "CONVERTED";
type Visitor = { id: string; name: string; phone: string; birthDate: string; status: Status; createdAt: string; updatedAt: string };
type Result = { visitors: Visitor[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type Api = { success: boolean; data?: Result; error?: { message?: string } };

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

export function VisitorManager() {
  const [result, setResult] = useState<Result>();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | Status>("");
  const [sortBy, setSortBy] = useState<"name" | "createdAt" | "updatedAt">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20", sortBy, sortOrder });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    return params.toString();
  }, [page, search, sortBy, sortOrder, status]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/visitors?${query}`, { cache: "no-store" });
      const data = await response.json() as Api;
      if (!data.success || !data.data) setMessage(data.error?.message ?? "Nao foi possivel carregar visitantes.");
      else { setResult(data.data); setMessage(""); }
    } catch { setMessage("Nao foi possivel carregar visitantes."); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
          Pesquisar
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="rounded-md border border-hope-100 px-3 py-2 text-sm" placeholder="Nome ou telefone" />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
          Situacao
          <select value={status} onChange={(event) => { setStatus(event.target.value as "" | Status); setPage(1); }} className="rounded-md border border-hope-100 px-3 py-2 text-sm">
            <option value="">Todos</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option><option value="CONVERTED">Convertido</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
          Ordenar por
          <select value={sortBy} onChange={(event) => { setSortBy(event.target.value as typeof sortBy); setPage(1); }} className="rounded-md border border-hope-100 px-3 py-2 text-sm">
            <option value="name">Nome</option><option value="createdAt">Data de cadastro</option><option value="updatedAt">Ultima alteracao</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
          Direcao
          <select value={sortOrder} onChange={(event) => { setSortOrder(event.target.value as typeof sortOrder); setPage(1); }} className="rounded-md border border-hope-100 px-3 py-2 text-sm">
            <option value="asc">Crescente</option><option value="desc">Decrescente</option>
          </select>
        </label>
      </section>
      {message ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{message}</p> : null}
      <div className="overflow-x-auto rounded-md border border-hope-100 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-hope-50 text-left"><tr><th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Nascimento</th><th className="p-3">Situacao</th><th className="p-3">Acoes</th></tr></thead>
          <tbody>
            {result?.visitors.map((visitor) => <tr key={visitor.id} className="border-t border-hope-100"><td className="p-3 font-semibold">{visitor.name}</td><td className="p-3">{formatPhone(visitor.phone)}</td><td className="p-3">{date(visitor.birthDate)}</td><td className="p-3"><VisitorStatusBadge status={visitor.status} /></td><td className="p-3"><Link className="font-bold text-hope-700 hover:text-hope-900" href={`/visitantes/${visitor.id}`}>Detalhes</Link></td></tr>)}
            {!loading && !result?.visitors.length ? <tr><td className="p-8 text-center text-ink-500" colSpan={5}>Nenhum visitante encontrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {loading ? <p aria-live="polite" className="text-sm text-ink-500">Carregando visitantes...</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-600">
        <span>{result?.pagination.total ?? 0} visitante(s)</span>
        <div className="flex items-center gap-2"><button type="button" disabled={!result || page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded border border-hope-100 px-3 py-2 disabled:opacity-50">Anterior</button><span>Pagina {result?.pagination.page ?? 1} de {result?.pagination.totalPages ?? 1}</span><button type="button" disabled={!result || page >= result.pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded border border-hope-100 px-3 py-2 disabled:opacity-50">Proxima</button></div>
      </div>
    </div>
  );
}
