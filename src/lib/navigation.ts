export type NavigationItem = {
  href: string;
  label: string;
  icon: string;
  permission?: string;
  administrative?: boolean;
};

export const navigationItems: readonly NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "Inicio", permission: "dashboard.admin.view" },
  { href: "/portal", label: "Portal do Membro", icon: "Inicio", permission: "memberPortal.view", administrative: false },
  { href: "/membros", label: "Membros", icon: "Pessoas", permission: "member.view" },
  { href: "/perfis-acesso", label: "Perfis de Acesso", icon: "Chaves", permission: "accessRole.view" },
  { href: "/usuarios", label: "Usuários", icon: "Usuarios", permission: "user.view" },
  { href: "/ministerios", label: "Ministérios", icon: "Servir", permission: "ministry.view" },
  { href: "/membros-ministerios", label: "Membros x Ministérios", icon: "Vinculos", permission: "memberMinistry.view" },
  { href: "/escalas", label: "Escalas", icon: "Agenda", permission: "schedule.view" },
  { href: "/minhas-escalas", label: "Minhas Escalas", icon: "Agenda", permission: "mySchedule.view", administrative: false },
  { href: "/musicas", label: "Músicas", icon: "Agenda", permission: "song.view" },
  { href: "/eventos", label: "Eventos", icon: "Agenda", permission: "event.view" },
  { href: "/comunicados", label: "Comunicados", icon: "Agenda", permission: "announcement.view" },
  { href: "/financeiro/categorias", label: "Financeiro - Categorias", icon: "Dizimos", permission: "financialCategory.view" },
  { href: "/financeiro/lancamentos", label: "Financeiro - Lançamentos", icon: "Dizimos", permission: "financialEntry.view" },
  { href: "/financeiro/fechamentos", label: "Financeiro - Fechamento", icon: "Dizimos", permission: "financialClosing.view" },
  { href: "/relatorios", label: "Relatórios", icon: "Dizimos", permission: "report.view" },
  { href: "/solicitacoes-acesso", label: "Solicitações de acesso", icon: "Chaves", permission: "accessRequest.view" },
  { href: "/solicitacoes-recuperacao-senha", label: "Recuperação de senha", icon: "Chaves", permission: "passwordResetRequest.view" },
  { href: "/notificacoes/historico", label: "Histórico de notificações", icon: "Agenda", permission: "push.logs.view" },
  { href: "/notificacoes/saude", label: "Saúde das Notificações", icon: "Agenda", permission: "push.logs.view" },
  { href: "/ajuda", label: "Ajuda", icon: "Inicio", administrative: false }
];

export const portalNavigationItems = [
  { href: "/portal", label: "Início" },
  { href: "/portal/meu-cadastro", label: "Meu cadastro" },
  { href: "/portal/meu-usuario", label: "Meu usuário", permission: "memberAccount.view" },
  { href: "/portal/minhas-escalas", label: "Minhas Escalas" },
  { href: "/portal/eventos", label: "Eventos" },
  { href: "/portal/avisos", label: "Avisos" },
  { href: "/portal/meus-ministerios", label: "Meus Ministérios" },
  { href: "/portal/minhas-contribuicoes", label: "Minhas Contribuições" },
  { href: "/ajuda", label: "Ajuda" }
] as const;

export function getAllowedNavigationItems(permissionCodes: string[]) {
  return navigationItems.filter((item) => !item.permission || permissionCodes.includes(item.permission));
}

export function getAllowedPortalNavigationItems(permissionCodes: string[]) {
  return portalNavigationItems.filter(
    (item) => !("permission" in item) || permissionCodes.includes(item.permission)
  );
}

export function getFirstAllowedAdministrativeRoute(permissionCodes: string[]) {
  return navigationItems.find(
    (item) => item.administrative !== false && item.permission && permissionCodes.includes(item.permission)
  )?.href ?? null;
}
