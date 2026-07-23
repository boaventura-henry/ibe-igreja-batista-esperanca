export type AppReleaseStatus = "UNRELEASED" | "PUBLISHED" | "ARCHIVED";
export type AppReleaseType = "MAJOR" | "MINOR" | "PATCH";

export type AppRelease = {
  version: string;
  title: string;
  summary: string;
  type: AppReleaseType;
  status: AppReleaseStatus;
  releaseDate: string | null;
  highlights: string[];
  technicalNotes?: string[];
};

export const appReleases: readonly AppRelease[] = [
  {
    version: "0.2.1",
    title: "Evolucoes operacionais planejadas",
    summary: "Ciclo de desenvolvimento para evoluir autorizacao ministerial, repertorios e organizacao de registros.",
    type: "PATCH",
    status: "UNRELEASED",
    releaseDate: null,
    highlights: [
      "RBAC por ministerio",
      "Historico de utilizacao das musicas",
      "Arquivamento automatico"
    ],
    technicalNotes: ["Escopo inicial registrado. Nenhuma funcionalidade desta versao foi implementada."]
  },
  {
    version: "0.2.0",
    title: "Dashboard configuravel por perfil",
    summary: "RBAC granular, layout responsivo por perfil e comunicacao estruturada das evolucoes do aplicativo.",
    type: "MINOR",
    status: "PUBLISHED",
    releaseDate: "2026-07-23",
    highlights: ["Permissoes especificas por card", "Layout configuravel por perfil", "Visibilidade por dispositivo", "Categorias e prioridades tipadas", "Dashboard Portal respeitando a configuracao do perfil", "Protecao backend de dados financeiros"],
    technicalNotes: ["Migrations da entrega aplicadas e validadas.", "Release publicada apos homologacao da versao 0.2.0."]
  }
];
