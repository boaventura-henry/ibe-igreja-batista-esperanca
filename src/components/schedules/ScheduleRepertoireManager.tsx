"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { FormMessage } from "@/components/ui/FormMessage";
import { musicKeys } from "@/utils/music";
import { getMemberOptionLabel } from "@/utils";
import type { ScheduleRepertoireResult, ScheduleSongFormValues, ScheduleSongSummary, SongOption } from "@/types";

type Api<T> = { success: true; data: T } | { success: false; error: { message: string } };
const empty: ScheduleSongFormValues = { songId: "", position: 1, referenceKey: "", performanceKey: "", leadMemberId: "", youtubeUrlOverride: "", resourceUrlOverride: "", useSimplifiedVersion: false, notes: "" };
const input = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800";
function normalizeSearch(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase(); }
function highlightText(text: string, query: string): ReactNode {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return text;
  let normalizedText = "";
  const indexMap: number[] = [];
  Array.from(text).forEach((character, index) => {
    const normalizedCharacter = character.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    normalizedText += normalizedCharacter;
    normalizedCharacter.split("").forEach(() => indexMap.push(index));
  });
  const matchStart = normalizedText.indexOf(normalizedQuery);
  if (matchStart < 0 || indexMap[matchStart] === undefined) return text;
  const matchEnd = matchStart + normalizedQuery.length - 1;
  const originalStart = indexMap[matchStart];
  const originalEnd = indexMap[matchEnd] ?? originalStart;
  return <>{text.slice(0, originalStart)}<mark className="rounded bg-hope-100 px-0.5 text-ink-900">{text.slice(originalStart, originalEnd + 1)}</mark>{text.slice(originalEnd + 1)}</>;
}

export function ScheduleRepertoireManager({ scheduleId, scheduleTitle, canUpdate }: { scheduleId: string; scheduleTitle: string; canUpdate: boolean }) {
  const { data: session } = useSession();
  const [data, setData] = useState<ScheduleRepertoireResult | null>(null);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [songSuccessMessage, setSongSuccessMessage] = useState("");
  const [copyOpen, setCopyOpen] = useState(false);
  const [songOptions, setSongOptions] = useState<SongOption[]>([]);
  const [selectedSong, setSelectedSong] = useState<SongOption | null>(null);
  const [songSearch, setSongSearch] = useState("");
  const [songOptionsOpen, setSongOptionsOpen] = useState(false);
  const [songsLoading, setSongsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const optionsRequestId = useRef(0);
  const performanceKeyRef = useRef<HTMLInputElement>(null);
  const leadMemberRef = useRef<HTMLSelectElement>(null);
  const canCreateSong = session?.user.permissionCodes?.includes("song.create") ?? false;

  async function load() {
    const response = await fetch(`/api/schedules/${scheduleId}/songs`, { cache: "no-store" });
    const payload = await response.json() as Api<ScheduleRepertoireResult>;
    if (payload.success) {
      setData({
        ...payload.data,
        members: payload.data.members.map((member) => ({
          ...member,
          name: member.displayName ?? member.name,
        })),
        songs: payload.data.songs.map((song) => ({
          ...song,
          leadMember: song.leadMember
            ? { ...song.leadMember, name: song.leadMember.displayName ?? song.leadMember.name }
            : song.leadMember,
        })),
      });
      setForm((current) => ({ ...current, position: payload.data.songs.length + 1 }));
    } else {
      setMessage(payload.error.message);
    }
  }

  // The loader is intentionally scoped to the schedule to avoid refetching on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [scheduleId]);

  function start(item?: ScheduleSongSummary) {
    setEditingId(item?.id ?? null);
    setForm(item ? { songId: item.song.id, position: item.position, referenceKey: item.referenceKey ?? "", performanceKey: item.performanceKey ?? "", leadMemberId: item.leadMember?.id ?? "", youtubeUrlOverride: item.youtubeUrlOverride ?? "", resourceUrlOverride: item.resourceUrlOverride ?? "", useSimplifiedVersion: item.useSimplifiedVersion, notes: item.notes ?? "" } : { ...empty, position: (data?.songs.length ?? 0) + 1 });
    setSelectedSong(item ? { id: item.song.id, title: item.song.title, artist: item.song.artist, referenceKey: item.song.referenceKey, isActive: item.song.isActive } : null);
    setSongSearch("");
    setSongOptionsOpen(false);
    setFormMessage("");
    setSongSuccessMessage("");
    setOpen(true);
  }

  useEffect(() => {
    if (!songSuccessMessage) return;
    const timer = window.setTimeout(() => setSongSuccessMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [songSuccessMessage]);

  function handleQuickSongCreated() {
    setSongSuccessMessage("Música cadastrada e adicionada ao repertório.");
    window.requestAnimationFrame(() => {
      if (data?.members.length) leadMemberRef.current?.focus();
      else performanceKeyRef.current?.focus();
    });
  }

  function update<K extends keyof ScheduleSongFormValues>(key: K, value: ScheduleSongFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadSongOptions() {
    const requestId = ++optionsRequestId.current;
    setSongsLoading(true);
    try {
      const response = await fetch("/api/songs/options", { cache: "no-store" });
      const payload = await response.json() as Api<{ songs: SongOption[] }>;
      if (requestId !== optionsRequestId.current) return;
      if (payload.success) setSongOptions(payload.data.songs);
      else setFormMessage(payload.error.message);
    } catch {
      if (requestId === optionsRequestId.current) setFormMessage("Nao foi possivel carregar as musicas cadastradas.");
    } finally {
      if (requestId === optionsRequestId.current) setSongsLoading(false);
    }
  }

  // Fetch options only when the modal opens; request ids discard stale responses.
  useEffect(() => {
    if (open) void loadSongOptions();
    else optionsRequestId.current += 1;
  }, [open]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.songId) {
      setFormMessage("Selecione uma música.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(editingId ? `/api/schedules/${scheduleId}/songs/${editingId}` : `/api/schedules/${scheduleId}/songs`, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json() as Api<unknown>;
      if (!payload.success) {
        setFormMessage(payload.error.message);
        return;
      }

      setOpen(false);
      setMessage(editingId ? "Musica atualizada." : "Musica adicionada ao repertorio.");
      await load();
    } finally {
      setIsSaving(false);
    }
  }

  async function action(url: string, method = "POST", body?: unknown) {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json() as Api<unknown>;
    if (!payload.success) setMessage(payload.error.message);
    else { setMessage("Repertorio atualizado."); await load(); }
  }

  async function copy() {
    if (!data || !data.songs.length) return;
    const text = [`Escala de ${scheduleTitle}`, "", ...data.songs.map((item, index) => `${index + 1}. ${item.song.title}${item.performanceKey ? ` - ${item.performanceKey}` : ""}${item.leadMember ? `\n   Ministro: ${item.leadMember.name}` : ""}${item.youtubeUrlOverride || item.song.youtubeUrl ? `\n   Referencia: ${item.youtubeUrlOverride || item.song.youtubeUrl}` : ""}`)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Repertorio copiado para o WhatsApp.");
    } catch {
      window.prompt("Copie o repertorio", text);
      setMessage("Use a janela exibida para copiar o repertorio.");
    }
  }

  const selectedOrActiveOptions = selectedSong && !songOptions.some((song) => song.id === selectedSong.id) ? [selectedSong, ...songOptions] : songOptions;

  return <section className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-hope-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-ink-900">Repertorio</h2><p className="text-xs text-ink-500">{data?.songs.length ?? 0} musica(s)</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={copy} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold">Copiar para WhatsApp</button><button type="button" disabled={!canUpdate} onClick={() => setCopyOpen(true)} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold">Copiar repertorio</button><button type="button" disabled={!canUpdate} onClick={() => start()} className="rounded-md bg-hope-600 px-3 py-2 text-xs font-bold text-white">Adicionar musica</button></div></div>{message ? <div className="px-4 pt-3 text-sm font-semibold text-ink-800">{message}</div> : null}<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Musica</th><th className="px-4 py-3">Tom</th><th className="px-4 py-3">Ministro</th><th className="px-4 py-3">Material</th><th className="px-4 py-3 text-right">Acoes</th></tr></thead><tbody className="divide-y divide-hope-100">{data?.songs.map((item, index) => <tr key={item.id}><td className="px-4 py-4">{item.position}</td><td className="px-4 py-4"><p className="font-semibold text-ink-900">{item.song.title}</p><p className="text-xs text-ink-500">{item.song.artist || "-"}{item.useSimplifiedVersion ? " | Versao simplificada" : ""}</p></td><td className="px-4 py-4">{item.performanceKey || item.referenceKey || item.song.referenceKey || "-"}</td><td className="px-4 py-4">{item.leadMember?.name || "-"}</td><td className="px-4 py-4">{(item.youtubeUrlOverride || item.song.youtubeUrl || item.resourceUrlOverride || item.song.resourceUrl) ? <a target="_blank" rel="noopener noreferrer" href={item.youtubeUrlOverride || item.song.youtubeUrl || item.resourceUrlOverride || item.song.resourceUrl || "#"} className="font-semibold text-hope-700">Abrir</a> : "-"}</td><td className="px-4 py-4 text-right"><div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={!canUpdate || index === 0} onClick={() => action(`/api/schedules/${scheduleId}/songs/${item.id}/move`, "POST", { direction: "up" })} className="rounded-md border border-hope-100 px-2 py-1 text-xs font-bold disabled:opacity-40">Subir</button><button type="button" disabled={!canUpdate || index === (data?.songs.length ?? 1) - 1} onClick={() => action(`/api/schedules/${scheduleId}/songs/${item.id}/move`, "POST", { direction: "down" })} className="rounded-md border border-hope-100 px-2 py-1 text-xs font-bold disabled:opacity-40">Descer</button><button type="button" disabled={!canUpdate} onClick={() => start(item)} className="rounded-md border border-hope-100 px-2 py-1 text-xs font-bold">Editar</button><button type="button" disabled={!canUpdate} onClick={() => action(`/api/schedules/${scheduleId}/songs/${item.id}`, "DELETE")} className="rounded-md border border-hope-100 px-2 py-1 text-xs font-bold">Remover</button></div></td></tr>)}{!data?.songs.length ? <tr><td colSpan={6} className="px-4 py-8 text-center font-semibold text-ink-500">Nenhuma musica no repertorio.</td></tr> : null}</tbody></table></div>
    {open ? <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6"><div className="mx-auto max-w-2xl rounded-md bg-white shadow-soft"><form onSubmit={save}><div className="flex items-start justify-between border-b border-hope-100 px-5 py-4"><h2 className="text-lg font-bold">{editingId ? "Editar musica" : "Adicionar musica"}</h2><button type="button" onClick={() => setOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold">Fechar</button></div><div className="grid gap-4 p-5 md:grid-cols-2"><div className="md:col-span-2"><FormMessage id="schedule-song-message">{formMessage}</FormMessage></div><div className="md:col-span-2"><SongSelector selectedSong={selectedSong} options={selectedOrActiveOptions} blockedSongIds={new Set((data?.songs ?? []).filter((item) => item.song.id !== form.songId).map((item) => item.song.id))} value={songSearch} loading={songsLoading} open={songOptionsOpen} onFocus={() => setSongOptionsOpen(true)} onSearch={setSongSearch} onSelect={(song) => { setSelectedSong(song); update("songId", song.id); setSongSearch(""); setSongOptionsOpen(false); }} onClear={() => { setSelectedSong(null); update("songId", ""); setSongOptionsOpen(true); }} onClose={() => setSongOptionsOpen(false)} onQuickCreateSuccess={handleQuickSongCreated} canCreateSong={canCreateSong} /><FormMessage id="quick-song-success" tone="success">{songSuccessMessage}</FormMessage></div><Field label="Posicao"><input required min={1} type="number" className={input} value={form.position} onChange={(e) => update("position", Number(e.target.value))} /></Field><Field label="Tom usado"><input ref={performanceKeyRef} className={input} value={form.performanceKey ?? ""} onChange={(e) => update("performanceKey", e.target.value)} placeholder="Ex.: G" /></Field><Field label="Ministro"><select ref={leadMemberRef} className={input} value={form.leadMemberId ?? ""} onChange={(e) => update("leadMemberId", e.target.value)}><option value="">Nao informado</option>{data?.members.map((member) => <option key={member.id} value={member.id}>{getMemberOptionLabel(member)}</option>)}</select></Field><Field label="Link YouTube da escala"><input type="url" className={input} value={form.youtubeUrlOverride ?? ""} onChange={(e) => update("youtubeUrlOverride", e.target.value)} /></Field><Field label="Link do material"><input type="url" className={input} value={form.resourceUrlOverride ?? ""} onChange={(e) => update("resourceUrlOverride", e.target.value)} /></Field><label className="flex items-center gap-2 text-sm font-semibold md:col-span-2"><input type="checkbox" checked={form.useSimplifiedVersion} onChange={(e) => update("useSimplifiedVersion", e.target.checked)} />Usar versao simplificada</label><Field label="Observacoes" className="md:col-span-2"><textarea className={`${input} min-h-20`} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} /></Field></div><div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4"><button type="button" onClick={() => setOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold">Cancelar</button><button disabled={isSaving} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isSaving ? "Salvando..." : "Salvar"}</button></div></form></div></div> : null}
    {copyOpen ? <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6"><div className="mx-auto max-w-md rounded-md bg-white p-5 shadow-soft"><h2 className="text-lg font-bold">Copiar repertorio</h2><div className="mt-4 grid gap-3">{data?.sources.map((source) => <div key={source.id} className="flex items-center justify-between gap-3 border-b border-hope-100 pb-3"><span className="text-sm font-semibold">{source.title} ({source.songCount})</span><div className="flex gap-2"><button type="button" disabled={!canUpdate} onClick={() => { void action(`/api/schedules/${scheduleId}/songs/copy`, "POST", { sourceScheduleId: source.id, mode: "append" }); setCopyOpen(false); }} className="rounded-md bg-hope-600 px-3 py-2 text-xs font-bold text-white">Adicionar</button><button type="button" disabled={!canUpdate} onClick={() => { void action(`/api/schedules/${scheduleId}/songs/copy`, "POST", { sourceScheduleId: source.id, mode: "replace" }); setCopyOpen(false); }} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold">Substituir</button></div></div>)}</div><button type="button" onClick={() => setCopyOpen(false)} className="mt-4 rounded-md border border-hope-100 px-4 py-2 text-sm font-bold">Fechar</button></div></div> : null}</section>;
}

function SongSelector({ selectedSong, options, blockedSongIds, value, loading, open, onFocus, onSearch, onSelect, onClear, onClose, onQuickCreateSuccess, canCreateSong }: { selectedSong: SongOption | null; options: SongOption[]; blockedSongIds: Set<string>; value: string; loading: boolean; open: boolean; onFocus: () => void; onSearch: (value: string) => void; onSelect: (song: SongOption) => void; onClear: () => void; onClose: () => void; onQuickCreateSuccess: () => void; canCreateSong: boolean }) {
  const selectorRef = useRef<HTMLDivElement>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateMessage, setQuickCreateMessage] = useState("");
  const [quickCreateSaving, setQuickCreateSaving] = useState(false);
  const [quickCreatedSong, setQuickCreatedSong] = useState<SongOption | null>(null);
  const [quickForm, setQuickForm] = useState({ title: "", artist: "", youtubeUrl: "", referenceKey: "" });
  const normalized = normalizeSearch(value);
  const hasQuery = value.trim().length >= 1;
  const availableOptions = quickCreatedSong && !options.some((song) => song.id === quickCreatedSong.id) ? [quickCreatedSong, ...options] : options;
  const filtered = availableOptions.filter((song) => normalizeSearch(`${song.title} ${song.artist ?? ""}`).includes(normalized));
  const visibleSongs = filtered.slice(0, 20);
  const hasMoreResults = filtered.length > visibleSongs.length;

  function openQuickCreate() {
    setQuickForm({ title: value.trim(), artist: "", youtubeUrl: "", referenceKey: "" });
    setQuickCreateMessage("");
    onClose();
    setQuickCreateOpen(true);
  }

  async function saveQuickCreate(event: FormEvent) {
    event.preventDefault();
    setQuickCreateMessage("");
    setQuickCreateSaving(true);
    try {
      const response = await fetch("/api/songs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...quickForm, isActive: true }) });
      const payload = await response.json() as Api<SongOption>;
      if (!payload.success) {
        setQuickCreateMessage(payload.error.message);
        return;
      }

      setQuickCreatedSong(payload.data);
      onSelect(payload.data);
      setQuickCreateOpen(false);
      onQuickCreateSuccess();
    } catch {
      setQuickCreateMessage("Nao foi possivel cadastrar a musica.");
    } finally {
      setQuickCreateSaving(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) onClose();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    function closeOnScroll() {
      onClose();
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open, onClose]);

  return <div ref={selectorRef} role="combobox" aria-expanded={open && hasQuery} aria-controls="schedule-song-options" className="relative z-20 grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 md:col-span-2"><span>Música</span><div className="flex gap-2"><input id="schedule-song-search" aria-label="Buscar música por título ou artista" aria-autocomplete="list" className={input} value={value} onFocus={() => { if (hasQuery) onFocus(); }} onChange={(event) => { onSearch(event.target.value); if (event.target.value.trim()) onFocus(); }} placeholder="Digite o título ou artista da música" /><button type="button" disabled={!selectedSong} onClick={onClear} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold disabled:opacity-40">Limpar</button></div>{selectedSong ? <p className="break-words normal-case tracking-normal text-hope-700">Selecionada: {selectedSong.title}{selectedSong.artist ? ` - ${selectedSong.artist}` : ""}{!selectedSong.isActive ? " (inativa, mantida para histórico)" : ""}</p> : null}{open && hasQuery ? <div id="schedule-song-options" role="listbox" aria-label="Opções de música" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto overscroll-contain rounded-md border border-hope-100 bg-white p-1 shadow-soft sm:max-h-72">{loading ? <p className="p-3 normal-case tracking-normal text-ink-500">Carregando músicas...</p> : visibleSongs.length ? <>{visibleSongs.map((song) => { const blocked = blockedSongIds.has(song.id); return <button key={song.id} type="button" role="option" aria-selected={song.id === selectedSong?.id} disabled={!song.isActive || blocked} onClick={() => onSelect(song)} className="block w-full break-words rounded-md px-3 py-2 text-left normal-case tracking-normal hover:bg-hope-50 focus-visible:bg-hope-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"><span>{highlightText(song.title, value)}</span>{song.artist ? <span className="text-ink-500"> - {highlightText(song.artist, value)}</span> : null}{!song.isActive ? " (inativa)" : blocked ? " (já adicionada)" : ""}</button>; })}{hasMoreResults ? <p className="border-t border-hope-100 px-3 py-2 text-xs normal-case tracking-normal text-ink-500">Mostrando 20 resultados. Continue digitando para refinar.</p> : null}{canCreateSong ? <button type="button" onClick={openQuickCreate} className="mt-1 block w-full border-t border-hope-100 px-3 py-2 text-left text-sm font-bold normal-case tracking-normal text-hope-700 hover:bg-hope-50">➕ Nova música</button> : null}</> : <div className="grid gap-2 p-3 normal-case tracking-normal text-ink-500"><span>Nenhuma música encontrada.</span>{canCreateSong ? <button type="button" onClick={openQuickCreate} className="break-words text-left font-bold normal-case tracking-normal text-hope-700 hover:underline">➕ Cadastrar &quot;{value.trim()}&quot;</button> : null}</div>}</div> : null}{quickCreateOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-900/55 px-4 py-6"><div role="dialog" aria-modal="true" aria-labelledby="quick-song-title" className="w-full max-w-md rounded-md bg-white p-5 shadow-soft"><div className="flex items-start justify-between gap-3"><h3 id="quick-song-title" className="text-lg font-bold text-ink-900">Nova música</h3><button type="button" disabled={quickCreateSaving} onClick={() => setQuickCreateOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold disabled:opacity-50">Fechar</button></div><form onSubmit={saveQuickCreate} className="mt-4 grid gap-3"><FormMessage id="quick-song-message">{quickCreateMessage}</FormMessage><label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">Título<input required disabled={quickCreateSaving} autoFocus className={input} value={quickForm.title} onChange={(event) => setQuickForm((current) => ({ ...current, title: event.target.value }))} /></label><label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">Artista<input disabled={quickCreateSaving} className={input} value={quickForm.artist} onChange={(event) => setQuickForm((current) => ({ ...current, artist: event.target.value }))} /></label><label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">YouTube<input disabled={quickCreateSaving} type="url" className={input} value={quickForm.youtubeUrl} onChange={(event) => setQuickForm((current) => ({ ...current, youtubeUrl: event.target.value }))} /></label><label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">Tom padrão<select disabled={quickCreateSaving} className={input} value={quickForm.referenceKey} onChange={(event) => setQuickForm((current) => ({ ...current, referenceKey: event.target.value }))}><option value="">Não informado</option>{musicKeys.map((key) => <option key={key}>{key}</option>)}</select></label><div className="flex justify-end gap-2 pt-2"><button type="button" disabled={quickCreateSaving} onClick={() => setQuickCreateOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold disabled:opacity-50">Cancelar</button><button type="submit" disabled={quickCreateSaving} className="rounded-md bg-hope-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{quickCreateSaving ? "Salvando música..." : "Salvar e continuar"}</button></div></form></div></div> : null}</div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <label className={`grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 ${className}`}>{label}{children}</label>; }
