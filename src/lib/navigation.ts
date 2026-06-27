export const navigationItems = [
  { href: "/dashboard", label: "Dashboard", icon: "Inicio" },
  { href: "/membros", label: "Membros", icon: "Pessoas" },
  { href: "/perfis-acesso", label: "Perfis de Acesso", icon: "Chaves", permission: "accessRole.view" },
  { href: "/usuarios", label: "Usuarios", icon: "Usuarios", permission: "user.view" },
  { href: "/ministerios", label: "Ministerios", icon: "Servir" },
  { href: "/eventos", label: "Eventos", icon: "Agenda" },
  { href: "/contribuicoes", label: "Contribuicoes", icon: "Dizimos" }
] as const;
