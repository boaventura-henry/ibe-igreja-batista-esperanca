"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  SongSummary,
  SongUsageHistoryResult
} from "@/types";

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

type Props = {
  song: SongSummary;
  onClose(): void;
};

type Filters = {
  search: string;
  ministryId: string;
  eventId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  sortOrder: "asc" | "desc";
};

const initialFilters: Filters = {
  search: "",
  ministryId: "",
  eventId: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  sortOrder: "desc"
};

const inputClass =
  "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

const statusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  COMPLETED: "Concluida",
  CANCELED: "Cancelada"
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(value)
  );
}

export function SongUsageHistoryModal({ song, onClose }: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SongUsageHistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      sortOrder: filters.sortOrder
    });

    Object.entries(filters).forEach(([key, value]) => {
      if (key !== "sortOrder" && value) {
        params.set(key, value);
      }
    });

    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/songs/${song.id}/usage-history?${query}`,
          { cache: "no-store", signal: controller.signal }
        );
        const payload = (await response.json()) as ApiResponse<SongUsageHistoryResult>;

        if (!payload.success) {
          setError(payload.error.message);
          return;
        }

        setData(payload.data);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError("Nao foi possivel carregar o historico da musica.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [query, song.id]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ink-900/45 px-3 py-4 sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="song-history-title"
    >
      <div className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-md bg-white shadow-soft sm:max-h-[calc(100vh-3rem)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hope-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-hope-700">
              Historico de utilizacao
            </p>
            <h2
              id="song-history-title"
              className="mt-1 break-words text-lg font-bold text-ink-900"
            >
              {song.title}
            </h2>
            <p className="text-sm text-ink-500">
              {song.artist || "Artista nao informado"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-hope-100 p-2 text-ink-700"
            aria-label="Fechar historico"
          >
            Fechar
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="grid gap-3 border-b border-hope-100 bg-hope-50/60 p-4 sm:grid-cols-3 sm:p-5">
            <Summary
              label="Utilizacoes"
              value={String(data?.summary.usageCount ?? 0)}
            />
            <Summary
              label="Primeira utilizacao"
              value={formatDate(data?.summary.firstUsedAt ?? null)}
            />
            <Summary
              label="Ultima utilizacao"
              value={formatDate(data?.summary.lastUsedAt ?? null)}
            />
          </section>

          <section className="grid gap-3 border-b border-hope-100 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
            <Field label="Escala">
              <input
                className={inputClass}
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Titulo da escala"
              />
            </Field>
            <Field label="Ministerio">
              <select
                className={inputClass}
                value={filters.ministryId}
                onChange={(event) => updateFilter("ministryId", event.target.value)}
              >
                <option value="">Todos</option>
                {data?.filters.ministries.map((ministry) => (
                  <option key={ministry.id} value={ministry.id}>
                    {ministry.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Evento">
              <select
                className={inputClass}
                value={filters.eventId}
                onChange={(event) => updateFilter("eventId", event.target.value)}
              >
                <option value="">Todos</option>
                {data?.filters.events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data inicial">
              <input
                type="date"
                className={inputClass}
                value={filters.dateFrom}
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
              />
            </Field>
            <Field label="Data final">
              <input
                type="date"
                className={inputClass}
                value={filters.dateTo}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
              />
            </Field>
            <Field label="Ordenacao">
              <select
                className={inputClass}
                value={filters.sortOrder}
                onChange={(event) =>
                  updateFilter("sortOrder", event.target.value as "asc" | "desc")
                }
              >
                <option value="desc">Mais recentes</option>
                <option value="asc">Mais antigas</option>
              </select>
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setFilters(initialFilters);
                  setPage(1);
                }}
                className="w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700"
              >
                Limpar filtros
              </button>
            </div>
          </section>

          {error ? (
            <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 sm:m-5">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-[980px] text-sm">
              <thead className="bg-hope-50 text-left text-xs font-bold uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-3">Data e escala</th>
                  <th className="px-4 py-3">Ministerio / evento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Posicao</th>
                  <th className="px-4 py-3">Tom</th>
                  <th className="px-4 py-3">Ministro</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Observacoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hope-100">
                {data?.usages.map((usage) => (
                  <tr key={usage.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-ink-900">
                        {formatDate(usage.date)}
                      </p>
                      <a
                        href={`/escalas/${usage.schedule.id}`}
                        className="mt-1 inline-flex items-center gap-1 text-hope-700 hover:underline"
                      >
                        {usage.schedule.title}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-ink-800">
                        {usage.ministry.name}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        {usage.event?.title || "Sem evento relacionado"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {statusLabels[usage.schedule.status] ?? usage.schedule.status}
                    </td>
                    <td className="px-4 py-4">{usage.position}</td>
                    <td className="px-4 py-4">
                      {usage.performanceKey || usage.referenceKey || "-"}
                    </td>
                    <td className="px-4 py-4">
                      {usage.leadMember?.displayName || "-"}
                    </td>
                    <td className="px-4 py-4">
                      {usage.materialUrl ? (
                        <a
                          href={usage.materialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-hope-700 hover:underline"
                        >
                          Abrir material
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="max-w-60 whitespace-normal px-4 py-4 text-ink-600">
                      {usage.notes || "-"}
                    </td>
                  </tr>
                ))}
                {!loading && !data?.usages.length ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center font-semibold text-ink-500"
                    >
                      Nenhuma utilizacao encontrada para os filtros informados.
                    </td>
                  </tr>
                ) : null}
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center font-semibold text-ink-500"
                    >
                      Carregando historico...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-hope-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="font-semibold text-ink-600">
            {data?.pagination.total ?? 0} utilizacao(oes)
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="min-w-24 text-center font-semibold text-ink-600">
              {page} de {data?.pagination.totalPages ?? 1}
            </span>
            <button
              type="button"
              disabled={
                loading || page >= (data?.pagination.totalPages ?? 1)
              }
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40"
            >
              Proxima
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-hope-100 bg-white p-3">
      <p className="text-xs font-bold uppercase text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold uppercase text-ink-500">
      {label}
      {children}
    </label>
  );
}
