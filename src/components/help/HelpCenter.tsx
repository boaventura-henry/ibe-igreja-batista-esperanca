"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { APP_VERSION } from "@/lib/app-version";
import { helpArticles, type HelpArticle } from "@/content/help/help-content";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function categoryKey(value: string) {
  return normalize(value);
}

function canSee(article: HelpArticle, permissionCodes: string[], authenticated: boolean) {
  if (article.audience === "PUBLIC") return true;
  if (!authenticated) return false;
  return (article.permissionCodes ?? []).every((permission) => permissionCodes.includes(permission));
}

export function HelpCenter() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const requestedId = searchParams.get("artigo");
  const sessionPermissionCodes = session?.user.permissionCodes;
  const permissionCodes = useMemo(() => sessionPermissionCodes ?? [], [sessionPermissionCodes]);
  const accessibleArticles = useMemo(() => helpArticles.filter((article) => canSee(article, permissionCodes, Boolean(session))), [permissionCodes, session]);
  const categories = useMemo(() => {
    const seen = new Set<string>();
    return ["Todas", ...accessibleArticles.flatMap((article) => {
      const key = categoryKey(article.category);
      if (seen.has(key)) return [];
      seen.add(key);
      return [article.category];
    })];
  }, [accessibleArticles]);
  const visibleArticles = useMemo(() => {
    const normalizedQuery = normalize(query);
    const selectedCategoryKey = categoryKey(category);
    return accessibleArticles.filter((article) => {
      if (category !== "Todas" && categoryKey(article.category) !== selectedCategoryKey) return false;
      if (!normalizedQuery) return true;
      const searchable = normalize([
        article.title,
        article.description,
        ...article.keywords,
        ...article.steps.map((step) => `${step.title ?? ""} ${step.description}`),
        ...(article.notes ?? [])
      ].join(" "));
      return searchable.includes(normalizedQuery);
    });
  }, [accessibleArticles, category, query]);
  const requestedArticle = requestedId ? helpArticles.find((article) => article.id === requestedId) ?? null : null;
  const selectedArticle = requestedArticle && accessibleArticles.some((article) => article.id === requestedArticle.id) ? requestedArticle : null;
  const requestedArticleUnavailable = Boolean(requestedId && !selectedArticle);
  const articleList = selectedArticle ? [selectedArticle] : visibleArticles;

  if (status === "loading") {
    return <main className="min-h-screen bg-[#f7faf8] px-4 py-8 text-sm font-semibold text-ink-600 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl rounded-md border border-hope-100 bg-white p-8 shadow-sm">Carregando a Central de Ajuda...</div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] px-4 py-8 text-ink-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-hope-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href={session ? (permissionCodes.includes("memberPortal.view") && !permissionCodes.includes("dashboard.admin.view") ? "/portal" : "/dashboard") : "/login"} className="text-sm font-bold text-hope-700 hover:underline">Voltar</Link>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Central de Ajuda</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">Encontre orientações simples para acessar e usar o sistema IBE.</p>
          </div>
          <span className="text-xs font-semibold text-ink-500">IBE v{APP_VERSION}</span>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_1fr]">
          <aside className="h-fit rounded-md border border-hope-100 bg-white p-4 shadow-sm">
            <label htmlFor="help-search" className="text-xs font-bold uppercase tracking-wide text-ink-500">Pesquisar ajuda</label>
            <input id="help-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: senha, escala, música" className="mt-2 w-full rounded-md border border-hope-100 px-3 py-2 text-sm outline-none focus:border-hope-500 focus:ring-2 focus:ring-hope-100" />
            <div className="mt-5 grid gap-1" aria-label="Categorias de ajuda">
              {categories.map((item) => <button key={item} type="button" onClick={() => { setCategory(item); if (selectedArticle) window.history.replaceState(null, "", "/ajuda"); }} className={`rounded-md px-3 py-2 text-left text-sm font-semibold ${category === item ? "bg-hope-600 text-white" : "text-ink-700 hover:bg-hope-50"}`}>{item}</button>)}
            </div>
          </aside>

          <section aria-live="polite">
            {selectedArticle || requestedArticleUnavailable ? <Link href="/ajuda" className="mb-4 inline-flex text-sm font-bold text-hope-700 hover:underline">← Todos os artigos</Link> : null}
            {requestedArticleUnavailable ? <div className="rounded-md border border-hope-100 bg-white p-8 text-center shadow-sm"><h2 className="text-lg font-bold">Este conteúdo não está disponível para o seu acesso.</h2><p className="mt-2 text-sm text-ink-600">Volte para a lista de artigos ou procure outro assunto.</p></div> : articleList.length === 0 ? <div className="rounded-md border border-hope-100 bg-white p-8 text-center shadow-sm"><h2 className="text-lg font-bold">Nenhum artigo encontrado</h2><p className="mt-2 text-sm text-ink-600">Tente outra palavra ou escolha uma categoria diferente.</p></div> : <div className="grid gap-4">{articleList.map((article) => <ArticleCard key={article.id} article={article} visibleArticles={accessibleArticles} />)}</div>}
          </section>
        </div>
      </div>
    </main>
  );
}

function ArticleCard({ article, visibleArticles }: { article: HelpArticle; visibleArticles: HelpArticle[] }) {
  return (
    <article id={article.id} className="scroll-mt-6 rounded-md border border-hope-100 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-hope-700">{article.category}</p>
      <h2 className="mt-2 text-xl font-bold text-ink-900">{article.title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-600">{article.description}</p>
      <ol className="mt-5 grid gap-3">{article.steps.map((step, index) => <li key={`${article.id}-${index}`} className="flex gap-3 text-sm leading-6 text-ink-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-hope-100 text-xs font-black text-hope-700">{index + 1}</span><span>{step.title ? <strong>{step.title}: </strong> : null}{step.description}</span></li>)}</ol>
      {article.notes?.length ? <div className="mt-5 grid gap-2">{article.notes.map((note) => <p key={note} className="rounded-md bg-hope-50 px-4 py-3 text-sm font-semibold leading-6 text-ink-700"><strong>Importante:</strong> {note}</p>)}</div> : null}
      {article.relatedArticleIds?.filter((id) => visibleArticles.some((visibleArticle) => visibleArticle.id === id)).length ? <div className="mt-5 border-t border-hope-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-ink-500">Artigos relacionados</p><div className="mt-2 flex flex-wrap gap-2">{article.relatedArticleIds.filter((id) => visibleArticles.some((visibleArticle) => visibleArticle.id === id)).map((id) => <Link key={id} href={`/ajuda?artigo=${id}`} className="text-sm font-bold text-hope-700 hover:underline">Ver artigo</Link>)}</div></div> : null}
    </article>
  );
}
