import type { AuthSessionUser } from "@/types";

export const availablePermissions = [
  { code: "dashboard.admin.view", name: "Visualizar dashboard administrativo", label: "Visualizar dashboard administrativo", module: "Dashboard" },
  { code: "dashboard.members.birthdays", name: "Visualizar aniversariantes no dashboard", label: "Aniversariantes", description: "Permite visualizar aniversariantes do dia, da semana e do mes no dashboard administrativo.", module: "Dashboard - Membros" },
  { code: "dashboard.members.summary", name: "Visualizar resumo de membros no dashboard", label: "Resumo de membros", description: "Permite visualizar totais e novos membros no dashboard administrativo.", module: "Dashboard - Membros" },
  { code: "dashboard.events.upcoming", name: "Visualizar proximos eventos no dashboard", label: "Proximos eventos", description: "Permite visualizar a lista de eventos futuros no dashboard administrativo.", module: "Dashboard - Eventos" },
  { code: "dashboard.scales.upcoming", name: "Visualizar proximas escalas no dashboard", label: "Proximas escalas", description: "Permite visualizar a lista de escalas futuras no dashboard administrativo.", module: "Dashboard - Escalas" },
  { code: "dashboard.finance.revenue", name: "Visualizar receitas no dashboard", label: "Receitas do mes", description: "Permite visualizar o total de receitas confirmadas no dashboard administrativo.", module: "Dashboard - Financeiro" },
  { code: "dashboard.finance.balance", name: "Visualizar saldo financeiro no dashboard", label: "Saldo financeiro", description: "Permite visualizar o saldo financeiro consolidado no dashboard administrativo.", module: "Dashboard - Financeiro" },
  { code: "dashboard.finance.summary", name: "Visualizar resumo financeiro no dashboard", label: "Resumo financeiro", description: "Permite visualizar receitas, despesas e saldo no resumo financeiro mensal.", module: "Dashboard - Financeiro" },
  { code: "dashboard.contributions.recent", name: "Visualizar contribuicoes recentes no dashboard", label: "Contribuicoes recentes", description: "Permite visualizar valores e contribuintes das entradas recentes confirmadas.", module: "Dashboard - Contribuicoes" },
  { code: "dashboard.announcements.summary", name: "Visualizar resumo de comunicados no dashboard", label: "Resumo de comunicados", description: "Permite visualizar indicadores de comunicados publicados, ativos e fixados.", module: "Dashboard - Comunicados" },
  { code: "dashboard.notifications.health", name: "Visualizar saude das notificacoes no dashboard", label: "Saude das notificacoes", description: "Permite visualizar metricas operacionais, falhas e recuperacao das notificacoes push.", module: "Dashboard - Notificacoes" },
  { code: "dashboard.portal.view", name: "Visualizar dashboard do portal", label: "Visualizar dashboard do portal", module: "Portal do Membro" },
  { code: "push.logs.view", name: "Visualizar historico de notificacoes", label: "Visualizar historico", module: "Administracao" },
  { code: "push.logs.retry", name: "Reenviar notificacoes com falha", label: "Reenviar falhas", module: "Administracao" },
  { code: "report.view", name: "Visualizar relatorios", label: "Visualizar relatorios", module: "Relatorios" },
  { code: "report.export", name: "Exportar relatorios", label: "Exportar relatorios", module: "Relatorios" },
  { code: "member.view", name: "Visualizar membros", label: "Visualizar membros", module: "Membros" },
  { code: "member.create", name: "Criar membros", label: "Criar membros", module: "Membros" },
  { code: "member.update", name: "Alterar membros", label: "Alterar membros", module: "Membros" },
  { code: "member.delete", name: "Excluir membros", label: "Excluir membros", module: "Membros" },
  { code: "member.photo.upload", name: "Enviar foto de membro", label: "Enviar foto de membro", module: "Membros" },
  { code: "member.export", name: "Exportar membros", label: "Exportar membros", module: "Membros" },
  { code: "ministry.view", name: "Visualizar ministerios", label: "Visualizar ministerios", module: "Ministerios" },
  { code: "ministry.create", name: "Criar ministerios", label: "Criar ministerios", module: "Ministerios" },
  { code: "ministry.update", name: "Alterar ministerios", label: "Alterar ministerios", module: "Ministerios" },
  { code: "ministry.delete", name: "Excluir ministerios", label: "Excluir ministerios", module: "Ministerios" },
  {
    code: "memberMinistry.view",
    name: "Visualizar vinculos membro-ministerio",
    label: "Visualizar vinculos",
    module: "Membros x Ministerios"
  },
  {
    code: "memberMinistry.create",
    name: "Criar vinculos membro-ministerio",
    label: "Criar vinculos",
    module: "Membros x Ministerios"
  },
  {
    code: "memberMinistry.update",
    name: "Alterar vinculos membro-ministerio",
    label: "Alterar vinculos",
    module: "Membros x Ministerios"
  },
  {
    code: "memberMinistry.delete",
    name: "Excluir vinculos membro-ministerio",
    label: "Excluir vinculos",
    module: "Membros x Ministerios"
  },
  { code: "schedule.view", name: "Visualizar escalas", label: "Visualizar escalas", module: "Escalas" },
  { code: "schedule.create", name: "Criar escalas", label: "Criar escalas", module: "Escalas" },
  { code: "schedule.update", name: "Alterar escalas", label: "Alterar escalas", module: "Escalas" },
  { code: "schedule.delete", name: "Excluir escalas", label: "Excluir escalas", module: "Escalas" },
  { code: "schedule.publish", name: "Publicar escalas", label: "Publicar escalas", module: "Escalas" },
  { code: "schedule.cancel", name: "Cancelar escalas", label: "Cancelar escalas", module: "Escalas" },
  { code: "schedule.complete", name: "Concluir escalas", label: "Concluir escalas", module: "Escalas" },
  { code: "schedule.confirm", name: "Confirmar escalas", label: "Confirmar escalas", module: "Escalas" },
  { code: "song.view", name: "Visualizar musicas", label: "Visualizar musicas", module: "Musicas" },
  { code: "song.create", name: "Criar musicas", label: "Criar musicas", module: "Musicas" },
  { code: "song.update", name: "Alterar musicas", label: "Alterar musicas", module: "Musicas" },
  { code: "song.delete", name: "Excluir musicas", label: "Excluir musicas", module: "Musicas" },
  { code: "mySchedule.view", name: "Visualizar minhas escalas", label: "Visualizar minhas escalas", module: "Minhas Escalas" },
  { code: "mySchedule.confirm", name: "Responder minhas escalas", label: "Responder minhas escalas", module: "Minhas Escalas" },
  { code: "event.view", name: "Visualizar eventos", label: "Visualizar eventos", module: "Eventos" },
  { code: "event.create", name: "Criar eventos", label: "Criar eventos", module: "Eventos" },
  { code: "event.update", name: "Alterar eventos", label: "Alterar eventos", module: "Eventos" },
  { code: "event.delete", name: "Excluir eventos", label: "Excluir eventos", module: "Eventos" },
  { code: "event.publish", name: "Publicar eventos", label: "Publicar eventos", module: "Eventos" },
  { code: "event.cancel", name: "Cancelar eventos", label: "Cancelar eventos", module: "Eventos" },
  { code: "event.complete", name: "Concluir eventos", label: "Concluir eventos", module: "Eventos" },
  { code: "announcement.view", name: "Visualizar comunicados", label: "Visualizar comunicados", module: "Comunicados" },
  { code: "announcement.create", name: "Criar comunicados", label: "Criar comunicados", module: "Comunicados" },
  { code: "announcement.update", name: "Alterar comunicados", label: "Alterar comunicados", module: "Comunicados" },
  { code: "announcement.delete", name: "Excluir comunicados", label: "Excluir comunicados", module: "Comunicados" },
  { code: "announcement.publish", name: "Publicar comunicados", label: "Publicar comunicados", module: "Comunicados" },
  { code: "announcement.archive", name: "Arquivar comunicados", label: "Arquivar comunicados", module: "Comunicados" },
  { code: "financialCategory.view", name: "Visualizar categorias financeiras", label: "Visualizar categorias", module: "Financeiro" },
  { code: "financialCategory.create", name: "Criar categorias financeiras", label: "Criar categorias", module: "Financeiro" },
  { code: "financialCategory.update", name: "Alterar categorias financeiras", label: "Alterar categorias", module: "Financeiro" },
  { code: "financialCategory.delete", name: "Excluir categorias financeiras", label: "Excluir categorias", module: "Financeiro" },
  { code: "financialEntry.view", name: "Visualizar lancamentos financeiros", label: "Visualizar lancamentos", module: "Financeiro" },
  { code: "financialEntry.create", name: "Criar lancamentos financeiros", label: "Criar lancamentos", module: "Financeiro" },
  { code: "financialEntry.update", name: "Alterar lancamentos financeiros", label: "Alterar lancamentos", module: "Financeiro" },
  { code: "financialEntry.delete", name: "Excluir lancamentos financeiros", label: "Excluir lancamentos", module: "Financeiro" },
  { code: "financialEntry.cancel", name: "Cancelar lancamentos financeiros", label: "Cancelar lancamentos", module: "Financeiro" },
  { code: "financialClosing.view", name: "Visualizar fechamentos financeiros", label: "Visualizar fechamentos", module: "Financeiro" },
  { code: "financialClosing.create", name: "Criar fechamentos financeiros", label: "Criar fechamentos", module: "Financeiro" },
  { code: "financialClosing.update", name: "Alterar fechamentos financeiros", label: "Alterar fechamentos", module: "Financeiro" },
  { code: "financialClosing.delete", name: "Excluir fechamentos financeiros", label: "Excluir fechamentos", module: "Financeiro" },
  { code: "memberContribution.view", name: "Visualizar minhas contribuicoes", label: "Visualizar contribuicoes", module: "Portal do Membro" },
  { code: "portalAnnouncement.view", name: "Visualizar comunicados do portal", label: "Visualizar comunicados", module: "Portal do Membro" },
  { code: "memberPortal.view", name: "Acessar portal do membro", label: "Acessar portal", module: "Portal do Membro" },
  { code: "memberPortal.updateProfile", name: "Atualizar proprio cadastro", label: "Atualizar cadastro", module: "Portal do Membro" },
  { code: "memberAccount.view", name: "Visualizar meu usuario", label: "Visualizar meu usuario", module: "Portal do Membro" },
  { code: "memberAccount.update", name: "Atualizar meu usuario", label: "Atualizar meu usuario", module: "Portal do Membro" },
  { code: "memberAccount.changePassword", name: "Alterar propria senha", label: "Alterar senha", module: "Portal do Membro" },
  {
    code: "accessRequest.view",
    name: "Visualizar solicitacoes de acesso",
    label: "Visualizar solicitacoes",
    module: "Solicitacoes de Acesso"
  },
  {
    code: "accessRequest.approve",
    name: "Aprovar solicitacoes de acesso",
    label: "Aprovar solicitacoes",
    module: "Solicitacoes de Acesso"
  },
  {
    code: "accessRequest.reject",
    name: "Rejeitar solicitacoes de acesso",
    label: "Rejeitar solicitacoes",
    module: "Solicitacoes de Acesso"
  },
  {
    code: "passwordResetRequest.view",
    name: "Visualizar solicitacoes de recuperacao de senha",
    label: "Visualizar recuperacoes",
    module: "Recuperacao de Senha"
  },
  {
    code: "passwordResetRequest.approve",
    name: "Aprovar solicitacoes de recuperacao de senha",
    label: "Aprovar recuperacoes",
    module: "Recuperacao de Senha"
  },
  {
    code: "passwordResetRequest.reject",
    name: "Rejeitar solicitacoes de recuperacao de senha",
    label: "Rejeitar recuperacoes",
    module: "Recuperacao de Senha"
  },
  { code: "accessRole.view", name: "Visualizar perfis", label: "Visualizar perfis", module: "Perfis de Acesso" },
  { code: "accessRole.create", name: "Criar perfis", label: "Criar perfis", module: "Perfis de Acesso" },
  { code: "accessRole.update", name: "Alterar perfis", label: "Alterar perfis", module: "Perfis de Acesso" },
  { code: "accessRole.delete", name: "Excluir perfis", label: "Excluir perfis", module: "Perfis de Acesso" },
  { code: "user.view", name: "Visualizar usuarios", label: "Visualizar usuarios", module: "Usuarios" },
  { code: "user.create", name: "Criar usuarios", label: "Criar usuarios", module: "Usuarios" },
  { code: "user.update", name: "Alterar usuarios", label: "Alterar usuarios", module: "Usuarios" },
  { code: "user.delete", name: "Excluir usuarios", label: "Excluir usuarios", module: "Usuarios" },
  { code: "user.resetPassword", name: "Redefinir senha", label: "Redefinir senha", module: "Usuarios" },
  { code: "user.lock", name: "Bloquear usuario", label: "Bloquear usuario", module: "Usuarios" },
  { code: "user.unlock", name: "Desbloquear usuario", label: "Desbloquear usuario", module: "Usuarios" },
  {
    code: "system.diagnostics.view",
    name: "Visualizar diagnosticos do sistema",
    label: "Visualizar diagnosticos",
    description: "Permite visualizar versao, build e alinhamento das migrations do banco.",
    module: "Sistema"
  },
  {
    code: "system.settings.view",
    name: "Visualizar configuracoes",
    label: "Visualizar configuracoes",
    module: "Sistema"
  },
  {
    code: "system.settings.update",
    name: "Alterar configuracoes",
    label: "Alterar configuracoes",
    module: "Sistema"
  }
] as const;

export type PermissionCode = (typeof availablePermissions)[number]["code"];
export type PermissionKey = PermissionCode;

export const permissionCodes = availablePermissions.map((permission) => permission.code) as [
  PermissionCode,
  ...PermissionCode[]
];
export const permissionKeys = permissionCodes;

export type AuthPermission = {
  code: string;
  name: string;
  label: string;
  module: string;
};

export function isPermissionCode(value: string): value is PermissionCode {
  return permissionCodes.includes(value as PermissionCode);
}

export const isPermissionKey = isPermissionCode;

export function getPermissionCodes(permissions: Array<string | AuthPermission> | null | undefined) {
  return (permissions ?? []).map((permission) =>
    typeof permission === "string" ? permission : permission.code
  );
}

export function hasPermission(
  subject:
    | AuthSessionUser
    | {
        role?: string | null;
        permissions?: Array<string | AuthPermission> | null;
        permissionCodes?: string[] | null;
      }
    | null
    | undefined,
  permission: PermissionCode
) {
  if (!subject) {
    return false;
  }

  if ("permissions" in subject) {
    if (subject.permissionCodes) {
      return subject.permissionCodes.includes(permission);
    }

    return getPermissionCodes(subject.permissions).includes(permission);
  }

  return false;
}
