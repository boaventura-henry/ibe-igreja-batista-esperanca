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
