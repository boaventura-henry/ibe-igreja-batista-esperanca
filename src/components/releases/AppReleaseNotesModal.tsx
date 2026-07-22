"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { PublicAppRelease } from "@/services/app-release.service";

type PendingResponse = { success: true; data: { hasPendingRelease: boolean; release: PublicAppRelease | null } } | { success: false };

export function AppReleaseNotesModal() {
  const [release, setRelease] = useState<PublicAppRelease | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const requested = useRef(false);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    const controller = new AbortController();
    void fetch("/api/app/releases/pending", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json() as Promise<PendingResponse>)
      .then((payload) => { if (payload.success && payload.data.hasPendingRelease) setRelease(payload.data.release); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!release) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setRelease(null); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [release]);

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function confirmSeen() {
    if (!release || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/app/releases/seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: release.version }) });
      const payload = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Nao foi possivel registrar a confirmacao.");
      setRelease(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel registrar a confirmacao.");
    } finally {
      setSaving(false);
    }
  }

  if (!release) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="release-notes-title" onKeyDown={trapFocus} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-wide text-hope-700">Novidades da versao {release.version}</p>
        <h2 id="release-notes-title" className="mt-2 text-2xl font-bold text-ink-900">{release.title}</h2>
        <p className="mt-3 text-sm leading-6 text-ink-500">{release.summary}</p>
        <h3 className="mt-5 font-bold text-ink-900">Principais melhorias</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink-700">{release.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
        {error ? <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Link href="/sobre#historico" onClick={() => setRelease(null)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">Ver todos os detalhes</Link>
          <button ref={confirmButton} type="button" disabled={saving} onClick={() => void confirmSeen()} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Salvando..." : "Entendi"}</button>
        </div>
      </section>
    </div>
  );
}
