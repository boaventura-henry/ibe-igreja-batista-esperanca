import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getAllowedNavigationItems,
  getAllowedPortalNavigationItems,
  navigationItems,
  portalNavigationItems
} from "../src/lib/navigation";

const administrativeContract = [
  ["/dashboard", "Dashboard", "dashboard.admin.view"],
  ["/portal", "Portal do Membro", "memberPortal.view"],
  ["/membros", "Membros", "member.view"],
  ["/perfis-acesso", "Perfis de Acesso", "accessRole.view"],
  ["/usuarios", "Usuários", "user.view"],
  ["/ministerios", "Ministérios", "ministry.view"],
  ["/membros-ministerios", "Membros x Ministérios", "memberMinistry.view"],
  ["/escalas", "Escalas", "schedule.view"],
  ["/minhas-escalas", "Minhas Escalas", "mySchedule.view"],
  ["/musicas", "Músicas", "song.view"],
  ["/eventos", "Eventos", "event.view"],
  ["/comunicados", "Comunicados", "announcement.view"],
  ["/financeiro/categorias", "Financeiro - Categorias", "financialCategory.view"],
  ["/financeiro/lancamentos", "Financeiro - Lançamentos", "financialEntry.view"],
  ["/financeiro/fechamentos", "Financeiro - Fechamento", "financialClosing.view"],
  ["/relatorios", "Relatórios", "report.view"],
  ["/solicitacoes-acesso", "Solicitações de acesso", "accessRequest.view"],
  ["/solicitacoes-recuperacao-senha", "Recuperação de senha", "passwordResetRequest.view"],
  ["/notificacoes/historico", "Histórico de notificações", "push.logs.view"],
  ["/notificacoes/saude", "Saúde das Notificações", "push.logs.view"],
  ["/ajuda", "Ajuda", null]
] as const;

const portalContract = [
  ["/portal", "Início", null],
  ["/portal/meu-cadastro", "Meu cadastro", null],
  ["/portal/meu-usuario", "Meu usuário", "memberAccount.view"],
  ["/portal/minhas-escalas", "Minhas Escalas", null],
  ["/portal/eventos", "Eventos", null],
  ["/portal/avisos", "Avisos", null],
  ["/portal/meus-ministerios", "Meus Ministérios", null],
  ["/portal/minhas-contribuicoes", "Minhas Contribuições", null],
  ["/ajuda", "Ajuda", null]
] as const;

let scenarios = 0;
function test(name: string, run: () => void) {
  run();
  scenarios += 1;
  console.log(`PASS ${scenarios}: ${name}`);
}

test("menu administrativo preserva ordem, rotas e permissoes", () => {
  assert.deepEqual(
    navigationItems.map((item) => [item.href, item.label, item.permission ?? null]),
    administrativeContract
  );
});

test("filtro administrativo preserva a ordem relativa", () => {
  const allowed = getAllowedNavigationItems([
    "dashboard.admin.view",
    "member.view",
    "schedule.view",
    "event.view"
  ]);
  assert.deepEqual(
    allowed.map((item) => item.label),
    ["Dashboard", "Membros", "Escalas", "Eventos", "Ajuda"]
  );
});

test("filtro administrativo nao concede nem remove acesso", () => {
  const allPermissions = navigationItems.flatMap((item) => item.permission ? [item.permission] : []);
  assert.deepEqual(getAllowedNavigationItems(allPermissions), navigationItems);
  assert.deepEqual(getAllowedNavigationItems([]).map((item) => item.href), ["/ajuda"]);
});

test("menu do Portal preserva ordem, rotas e permissoes", () => {
  assert.deepEqual(
    portalNavigationItems.map((item) => [
      item.href,
      item.label,
      "permission" in item ? item.permission : null
    ]),
    portalContract
  );
});

test("filtro do Portal preserva condicao de Meu Usuario", () => {
  assert(!getAllowedPortalNavigationItems([]).some((item) => item.href === "/portal/meu-usuario"));
  assert(
    getAllowedPortalNavigationItems(["memberAccount.view"])
      .some((item) => item.href === "/portal/meu-usuario")
  );
});

test("menus nao possuem rotas duplicadas", () => {
  assert.equal(new Set(navigationItems.map((item) => item.href)).size, navigationItems.length);
  assert.equal(new Set(portalNavigationItems.map((item) => item.href)).size, portalNavigationItems.length);
});

test("desktop e mobile reutilizam a mesma navegacao", () => {
  const appShell = readFileSync("src/components/AppShell.tsx", "utf8");
  const portalShell = readFileSync("src/components/portal/PortalShell.tsx", "utf8");
  assert.equal((appShell.match(/<Navigation/g) ?? []).length, 2);
  assert.equal((portalShell.match(/<Navigation/g) ?? []).length, 2);
  assert(portalShell.includes("getAllowedPortalNavigationItems(permissionCodes)"));
  assert(!portalShell.includes("const portalNavigation ="));
});

console.log(`Navigation order: ${scenarios} scenarios passed.`);
