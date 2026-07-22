import assert from "node:assert/strict";
import { helpArticles, type HelpArticle } from "../src/content/help/help-content";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function categoryKey(value: string) {
  return normalize(value);
}

function filterByCategory(category: string, articles: HelpArticle[] = helpArticles) {
  if (category === "Todas") return articles;
  const selectedCategoryKey = categoryKey(category);
  return articles.filter((article) => categoryKey(article.category) === selectedCategoryKey);
}

function filterBySearch(query: string, articles: HelpArticle[] = helpArticles) {
  const normalizedQuery = normalize(query);
  return articles.filter((article) => {
    const searchable = normalize([
      article.title,
      article.description,
      ...article.keywords,
      ...article.steps.map((step) => `${step.title ?? ""} ${step.description}`),
      ...(article.notes ?? [])
    ].join(" "));
    return searchable.includes(normalizedQuery);
  });
}

const ids = helpArticles.map((article) => article.id);
assert.equal(new Set(ids).size, ids.length, "IDs de artigos de ajuda devem ser unicos.");

const notificationKey = categoryKey("Notificações");
const userArticles = filterByCategory("Usuários e permissões");
assert(userArticles.some((article) => article.id === "criar-usuario"), "Topico Usuarios deve exibir artigo de criacao de usuario.");
assert(userArticles.every((article) => categoryKey(article.category) !== notificationKey), "Topico Usuarios nao deve exibir artigos de Notificacoes.");

const notificationArticles = filterByCategory("Notificações");
assert(notificationArticles.length > 0, "Topico Notificacoes deve exibir artigos de Notificacoes.");
assert(notificationArticles.every((article) => categoryKey(article.category) === notificationKey), "Topico Notificacoes deve conter apenas artigos de Notificacoes.");

const ministryArticles = filterByCategory("Ministérios");
assert(ministryArticles.length > 1, "Topico Ministerios deve ter multiplos artigos.");
assert(ministryArticles.every((article) => categoryKey(article.category) === categoryKey("Ministérios")), "Topico Ministerios deve conter apenas artigos de Ministerios.");

const searchResults = filterBySearch("senha");
assert(searchResults.some((article) => article.id === "recuperar-senha"), "Pesquisa continua retornando artigos por palavra-chave.");

const allArticles = filterByCategory("Todas");
assert.equal(allArticles.length, helpArticles.length, "Sem topico selecionado, todos os artigos acessiveis permanecem na lista base.");

console.log("Help topic filtering: scenarios passed.");
