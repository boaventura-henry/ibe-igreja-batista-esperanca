export const navigationItems = [
  { href: "/dashboard", label: "Dashboard", icon: "Inicio" },
  { href: "/membros", label: "Membros", icon: "Pessoas" },
  { href: "/perfis-acesso", label: "Perfis de Acesso", icon: "Chaves", permission: "accessRole.view" },
  { href: "/usuarios", label: "Usuarios", icon: "Usuarios", permission: "user.view" },
  { href: "/solicitacoes-acesso", label: "Solicitacoes de Acesso", icon: "Chaves", permission: "accessRequest.view" },
  { href: "/ministerios", label: "Ministerios", icon: "Servir", permission: "ministry.view" },
  { href: "/membros-ministerios", label: "Membros x Ministerios", icon: "Vinculos", permission: "memberMinistry.view" },
  { href: "/escalas", label: "Escalas", icon: "Agenda", permission: "schedule.view" },
  { href: "/minhas-escalas", label: "Minhas Escalas", icon: "Agenda", permission: "mySchedule.view" },
  { href: "/portal", label: "Portal do Membro", icon: "Inicio", permission: "memberPortal.view" },
  { href: "/eventos", label: "Eventos", icon: "Agenda" },
  { href: "/contribuicoes", label: "Contribuicoes", icon: "Dizimos" }
] as const;
