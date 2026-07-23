export type AppRoadmapStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "CANCELLED";

export type AppRoadmapItem = {
  code: string;
  title: string;
  description: string;
  status: AppRoadmapStatus;
  targetVersion?: string;
  category: string;
  order: number;
  public: boolean;
};

export const appRoadmap: readonly AppRoadmapItem[] = [
  { code: "dashboard-configurable", title: "Dashboard configuravel", description: "Layouts e widgets controlados por perfil.", status: "COMPLETED", targetVersion: "0.2.0", category: "Administracao", order: 10, public: true },
  { code: "ministry-rbac", title: "RBAC por Ministerio", description: "Permitir que o perfil limite a visualizacao de escalas aos ministerios vinculados ou libere todos os ministerios.", status: "PLANNED", targetVersion: "0.2.1", category: "Seguranca", order: 20, public: true },
  { code: "song-usage-history", title: "Historico de utilizacao das musicas", description: "Consultar datas, escalas, tons, ministros, materiais e quantidade de utilizacoes de cada musica.", status: "PLANNED", targetVersion: "0.2.1", category: "Ministerios", order: 30, public: true },
  { code: "automatic-archiving", title: "Arquivamento automatico", description: "Organizar escalas, eventos, comunicados e notificacoes em visoes pendentes, arquivadas e completas, avaliando status calculado por data.", status: "PLANNED", targetVersion: "0.2.1", category: "Sistema", order: 40, public: true },
  { code: "schedules-evolution", title: "Evolucao de escalas", description: "Melhorias continuas no planejamento e acompanhamento de escalas.", status: "PLANNED", category: "Ministerios", order: 50, public: true },
  { code: "financial-evolution", title: "Evolucao financeira", description: "Aprimoramentos de controles e relatorios financeiros.", status: "PLANNED", category: "Financeiro", order: 60, public: true },
  { code: "communications-evolution", title: "Comunicados", description: "Evolucao dos fluxos de comunicacao com membros.", status: "PLANNED", category: "Comunicacao", order: 70, public: true },
  { code: "visitors", title: "Visitantes", description: "Acompanhamento estruturado de visitantes.", status: "PLANNED", category: "Pessoas", order: 80, public: true },
  { code: "ebd", title: "EBD", description: "Recursos para gestao da Escola Biblica Dominical.", status: "PLANNED", category: "Ensino", order: 90, public: true },
  { code: "pwa-observability", title: "Observabilidade da PWA", description: "Diagnosticos internos adicionais para operacao da aplicacao instalavel.", status: "PLANNED", category: "Sistema", order: 100, public: false },
  { code: "assets", title: "Patrimonio", description: "Controle patrimonial da igreja.", status: "PAUSED", category: "Administracao", order: 110, public: true }
];
