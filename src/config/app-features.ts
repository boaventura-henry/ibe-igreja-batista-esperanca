export type AppFeature = {
  code: string;
  title: string;
  introducedIn: string;
  description: string;
};

export const appFeatures: AppFeature[] = [
  {
    code: "dashboard.widget-rbac",
    title: "Widgets autorizados por perfil",
    introducedIn: "0.2.0",
    description: "O backend consulta e devolve somente widgets autorizados para o perfil ativo."
  },
  {
    code: "dashboard.role-layout",
    title: "Layout do dashboard por perfil",
    introducedIn: "0.2.0",
    description: "Tamanho, ordem e visibilidade por dispositivo podem ser definidos por perfil."
  },
  {
    code: "application.versioning",
    title: "Versionamento do aplicativo",
    introducedIn: "0.2.0",
    description: "Versao SemVer centralizada e historico de recursos visivel no proprio sistema."
  },
  {
    code: "app.release-notes",
    title: "Novidades da versao",
    introducedIn: "0.2.0",
    description: "Apresenta ao usuario as melhorias da versao publicada."
  },
  {
    code: "app.roadmap",
    title: "Roadmap do sistema",
    introducedIn: "0.2.0",
    description: "Exibe as proximas evolucoes planejadas do sistema."
  },
  {
    code: "system.schema-diagnostics",
    title: "Diagnostico do schema",
    introducedIn: "0.2.0",
    description: "Compara a migration esperada pela aplicacao com a ultima aplicada no banco."
  }
];
