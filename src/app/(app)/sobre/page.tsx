import { PageHeader } from "@/components/PageHeader";
import { appFeatures } from "@/config/app-features";
import { appReleases, type AppReleaseStatus } from "@/config/app-releases";
import { appRoadmap, type AppRoadmapStatus } from "@/config/app-roadmap";
import { APP_VERSION, getAppVersionInfo } from "@/lib/app-version";
import { compareSemanticVersions } from "@/lib/semantic-version";
import { hasPermission } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";
import { systemDiagnosticsService } from "@/services/system-diagnostics.service";

const releaseLabels: Record<AppReleaseStatus, string> = { UNRELEASED: "Nao publicada", PUBLISHED: "Publicada", ARCHIVED: "Arquivada" };
const roadmapLabels: Record<AppRoadmapStatus, string> = { IN_PROGRESS: "Em desenvolvimento", PLANNED: "Planejado", COMPLETED: "Concluido", PAUSED: "Pausado", CANCELLED: "Cancelado" };
const schemaLabels = { UP_TO_DATE: "Atualizado", OUTDATED: "Pendente de atualizacao", AHEAD: "Banco adiantado", UNKNOWN: "Desconhecido", ERROR: "Indisponivel" } as const;

export default async function AboutPage() {
  const user = await requireCurrentUser();
  const canViewDiagnostics = hasPermission(user, "system.diagnostics.view");
  const version = getAppVersionInfo();
  const currentRelease = appReleases.find((release) => release.version === APP_VERSION) ?? null;
  const visibleReleases = appReleases
    .filter((release) => canViewDiagnostics || release.status === "PUBLISHED")
    .slice()
    .sort((left, right) => compareSemanticVersions(right.version, left.version));
  const visibleRoadmap = appRoadmap.filter((item) => (canViewDiagnostics || (item.public && item.status !== "CANCELLED"))).slice().sort((left, right) => left.order - right.order);
  const diagnostics = canViewDiagnostics ? await systemDiagnosticsService.getDiagnostics() : null;

  return (
    <section>
      <PageHeader eyebrow="Aplicativo" title="Sobre o sistema" description="IBE - Sistema de Gestao da Igreja Batista Esperanca" />

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-hope-100 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-hope-700">{currentRelease?.status === "PUBLISHED" ? "Ultima atualizacao" : "Proxima versao"}</p>
          <h2 className="mt-2 text-2xl font-bold text-ink-900">Versao {version.version}</h2>
          <p className="mt-1 font-semibold text-hope-700">{currentRelease?.title ?? version.releaseName}</p>
          <dl className="mt-4 grid gap-3 text-sm">
            <VersionRow label="Status" value={currentRelease ? releaseLabels[currentRelease.status] : "Sem registro"} />
            {currentRelease?.releaseDate ? <VersionRow label="Publicacao" value={currentRelease.releaseDate} /> : null}
          </dl>
          {currentRelease ? <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-500">{currentRelease.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul> : null}
        </article>

        <article className="rounded-lg border border-hope-100 bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold text-ink-900">Recursos desta entrega</h2>
          <ul className="mt-4 grid gap-4">{appFeatures.filter((feature) => feature.introducedIn === version.version).map((feature) => <li key={feature.code} className="border-l-4 border-hope-500 pl-3"><p className="font-bold text-ink-900">{feature.title}</p><p className="mt-1 text-sm leading-6 text-ink-500">{feature.description}</p></li>)}</ul>
        </article>
      </div>

      <section id="historico" className="mt-6 rounded-lg border border-hope-100 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink-900">Historico de releases</h2>
        <div className="mt-4 grid gap-3">
          {visibleReleases.length ? visibleReleases.map((release) => <article key={release.version} className="rounded-md bg-hope-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-ink-900">{release.version} - {release.title}</h3><span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-hope-700">{releaseLabels[release.status]}</span></div><p className="mt-2 text-sm text-ink-500">{release.summary}</p>{release.releaseDate ? <p className="mt-1 text-xs text-ink-500">Publicada em {release.releaseDate}</p> : null}<ul className="mt-2 list-disc pl-5 text-xs text-ink-500">{release.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>{canViewDiagnostics && release.technicalNotes?.length ? <div className="mt-3 border-t border-hope-100 pt-3"><p className="text-xs font-bold uppercase text-ink-500">Notas tecnicas</p><ul className="mt-1 list-disc pl-5 text-xs text-ink-500">{release.technicalNotes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}</article>) : <p className="text-sm text-ink-500">Nenhuma release publicada foi registrada.</p>}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-hope-100 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink-900">Proximas evolucoes</h2>
        <div className="mt-4 grid gap-5">{(["IN_PROGRESS", "PLANNED", "COMPLETED", "PAUSED", "CANCELLED"] as AppRoadmapStatus[]).map((status) => { const items = visibleRoadmap.filter((item) => item.status === status); if (!items.length) return null; return <div key={status}><h3 className="text-sm font-bold uppercase tracking-wide text-hope-700">{roadmapLabels[status]}</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{items.map((item) => <article key={item.code} className="rounded-md border border-hope-100 p-4"><div className="flex items-start justify-between gap-2"><p className="font-bold text-ink-900">{item.title}</p>{!item.public ? <span className="rounded-full bg-ink-100 px-2 py-1 text-[0.65rem] font-bold uppercase text-ink-700">Interno</span> : null}</div><p className="mt-1 text-sm text-ink-500">{item.description}</p>{item.targetVersion ? <p className="mt-2 text-xs font-semibold text-hope-700">Versao alvo: {item.targetVersion}</p> : null}</article>)}</div></div>; })}</div>
      </section>

      {diagnostics ? <section className="mt-6 rounded-lg border border-amber-100 bg-amber-50/40 p-5 shadow-soft"><h2 className="text-lg font-bold text-ink-900">Informacoes tecnicas</h2><p className="mt-1 text-xs text-ink-500">Visivel somente com a permissao de diagnosticos.</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><VersionRow label="Versao da aplicacao" value={diagnostics.application.version} /><VersionRow label="Ambiente" value={diagnostics.application.environment} />{diagnostics.application.commitHash ? <VersionRow label="Build" value={diagnostics.application.commitHash} /> : null}<VersionRow label="Banco" value={diagnostics.database.connection === "CONNECTED" ? "Conectado" : "Indisponivel"} /><VersionRow label="Schema" value={schemaLabels[diagnostics.database.status]} /><VersionRow label="Schema esperado" value={diagnostics.database.expectedMigration} /><VersionRow label="Ultima migration aplicada" value={diagnostics.database.lastMigration ?? "Nao identificada"} />{diagnostics.database.completedCount !== null ? <VersionRow label="Migrations concluidas" value={String(diagnostics.database.completedCount)} /> : null}{diagnostics.database.lastAppliedAt ? <VersionRow label="Ultima aplicacao" value={diagnostics.database.lastAppliedAt} /> : null}<VersionRow label="Falha pendente" value={diagnostics.database.hasFailedMigration ? "Sim" : "Nao identificada"} /></dl></section> : null}
    </section>
  );
}

function VersionRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-hope-100 pb-2"><dt className="font-semibold text-ink-500">{label}</dt><dd className="break-all text-right font-bold text-ink-900">{value}</dd></div>;
}
