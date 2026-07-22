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
    status: "UNRELEASED",
    releaseDate: null,
    highlights: ["Permissoes especificas por card", "Layout configuravel por perfil", "Visibilidade por dispositivo", "Categorias e prioridades tipadas", "Protecao backend de dados financeiros"],
    technicalNotes: ["As migrations desta entrega ainda nao foram aplicadas.", "A publicacao e a data serao registradas somente apos o deploy validado."]
  }
];
