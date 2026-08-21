"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InstrumentUsageHistoryResult } from "@/types";

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo"
});

export function formatInstrumentUsageDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatInstrumentUsageTime(value: string) {
  return timeFormatter.format(new Date(value));
}

export function InstrumentUsageHistory({
  instrumentId,
  canViewSchedule
}: {
  instrumentId: string;
  canViewSchedule: boolean;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InstrumentUsageHistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/instruments/${instrumentId}/usage?page=${page}&pageSize=10`,
          { cache: "no-store", signal: controller.signal }
        );
        const payload =
          (await response.json()) as ApiResponse<InstrumentUsageHistoryResult>;

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
        setError("Não foi possível carregar a utilização em escalas.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [instrumentId, page]);

  return (
    <section className="rounded-md border border-hope-100 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-ink-900">
            Utilização em escalas
          </h2>
          <p className="text-sm text-ink-500">
            Registro histórico separado das manutenções e ocorrências.
          </p>
        </div>
        {data?.pagination.total ? (
          <span className="text-sm font-semibold text-ink-500">
            {data.pagination.total} utilização(ões)
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm font-semibold text-ink-500">
          Carregando utilização em escalas...
        </p>
      ) : null}

      {!loading && !error && !data?.items.length ? (
        <p className="mt-4 rounded-md bg-hope-50 p-4 text-sm text-ink-600">
          Este instrumento ainda não possui utilização registrada em escalas.
        </p>
      ) : null}

      {!loading && data?.items.length ? (
        <div className="mt-4 grid gap-3">
          {data.items.map((item) => (
            <article
              key={item.id}
              className="grid gap-3 rounded-md border border-hope-100 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-ink-500">
                  {formatInstrumentUsageDate(item.schedule.date)}
                </p>
                <p className="break-words font-bold text-ink-900">
                  {item.schedule.title}
                </p>
                {item.schedule.deletedAt ? (
                  <span className="mt-1 inline-flex rounded bg-ink-100 px-2 py-1 text-xs font-bold text-ink-600">
                    Escala removida
                  </span>
                ) : canViewSchedule ? (
                  <Link
                    href={`/escalas/${item.schedule.id}`}
                    className="mt-1 inline-flex text-sm font-bold text-hope-700 hover:underline"
                  >
                    Ver escala
                  </Link>
                ) : null}
              </div>

              <div>
                <p className="font-semibold text-ink-900">
                  {item.member.displayName}
                </p>
                {item.member.displayName !== item.member.name ? (
                  <p className="text-xs text-ink-500">{item.member.name}</p>
                ) : null}
                <p className="mt-1 text-sm text-ink-600">
                  {item.category.name}
                </p>
              </div>

              <div className="text-sm text-ink-600">
                <p>
                  {item.endedAt
                    ? `${formatInstrumentUsageTime(item.startedAt)} até ${formatInstrumentUsageTime(item.endedAt)}`
                    : `Início registrado: ${formatInstrumentUsageTime(item.startedAt)}`}
                </p>
                {item.changeReason ? (
                  <p className="mt-1 break-words">
                    <span className="font-semibold">
                      Motivo registrado neste período:
                    </span>{" "}
                    {item.changeReason}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {data && data.pagination.totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="min-w-24 text-center font-semibold text-ink-600">
            Página {page} de {data.pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.pagination.totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      ) : null}
    </section>
  );
}
