export type NavigationItem = {
  href: string;
  label: string;
  icon: string;
  permission?: string;
  administrative?: boolean;
};

export const navigationItems: readonly NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "Inicio", permission: "dashboard.admin.view" },
  { href: "/membros", label: "Membros", icon: "Pessoas", permission: "member.view" },
  { href: "/perfis-acesso", label: "Perfis de Acesso", icon: "Chaves", permission: "accessRole.view" },
  { href: "/usuarios", label: "Usuarios", icon: "Usuarios", permission: "user.view" },
  { href: "/solicitacoes-acesso", label: "Solicitacoes de Acesso", icon: "Chaves", permission: "accessRequest.view" },
  { href: "/solicitacoes-recuperacao-senha", label: "Recuperacao de Senha", icon: "Chaves", permission: "passwordResetRequest.view" },
  { href: "/ministerios", label: "Ministerios", icon: "Servir", permission: "ministry.view" },
  { href: "/membros-ministerios", label: "Membros x Ministerios", icon: "Vinculos", permission: "memberMinistry.view" },
  { href: "/escalas", label: "Escalas", icon: "Agenda", permission: "schedule.view" },
  { href: "/musicas", label: "Musicas", icon: "Agenda", permission: "song.view" },
  { href: "/minhas-escalas", label: "Minhas Escalas", icon: "Agenda", permission: "mySchedule.view", administrative: false },
  { href: "/portal", label: "Portal do Membro", icon: "Inicio", permission: "memberPortal.view", administrative: false },
  { href: "/eventos", label: "Eventos", icon: "Agenda", permission: "event.view" },
  { href: "/comunicados", label: "Comunicados", icon: "Agenda", permission: "announcement.view" },
  { href: "/relatorios", label: "Relatorios", icon: "Dizimos", permission: "report.view" },
  { href: "/financeiro/categorias", label: "Financeiro - Categorias", icon: "Dizimos", permission: "financialCategory.view" },
  { href: "/financeiro/lancamentos", label: "Financeiro - Lancamentos", icon: "Dizimos", permission: "financialEntry.view" },
  { href: "/financeiro/fechamentos", label: "Financeiro - Fechamentos", icon: "Dizimos", permission: "financialClosing.view" },
  { href: "/contribuicoes", label: "Contribuicoes", icon: "Dizimos", permission: "financialEntry.view" },
  { href: "/ajuda", label: "Ajuda", icon: "Inicio", administrative: false }
];

export function getAllowedNavigationItems(permissionCodes: string[]) {
  return navigationItems.filter((item) => !item.permission || permissionCodes.includes(item.permission));
}

export function getFirstAllowedAdministrativeRoute(permissionCodes: string[]) {
  return navigationItems.find(
    (item) => item.administrative !== false && item.permission && permissionCodes.includes(item.permission)
  )?.href ?? null;
}
