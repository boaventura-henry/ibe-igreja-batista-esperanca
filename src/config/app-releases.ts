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
    version: "0.2.2",
    title: "Instrumentos e utilizacao em escalas",
    summary: "Gestao administrativa de instrumentos e integracao com as escalas de louvor, com historico e identificacao amigavel para membros e liderancas.",
    type: "PATCH",
    status: "PUBLISHED",
    releaseDate: "2026-08-21",
    highlights: [
      "Cadastro de instrumentos com categorias parametrizaveis, ministerio opcional, situacao, ocorrencias e historico tecnico de manutencoes e substituicoes",
      "Exclusao segura, preservacao do historico patrimonial e permissoes granulares para administrar instrumentos e categorias",
      "Vinculo do instrumento fisico ao participante instrumentista, com categoria musical e escolha entre instrumento da igreja ou instrumento proprio",
      "Selecao administrativa de instrumentos durante a montagem e edicao das escalas, preservando assignments e escalas anteriores",
      "Apresentacao amigavel da categoria musical em escalas, Minhas Escalas, Portal e notificacoes, mantendo os dados patrimoniais nas areas administrativas",
      "Troca de instrumento pelo proprio membro em Minhas Escalas, limitada a sua participacao e categoria, com motivo e historico preservados",
      "Nova secao Utilizacao em escalas no detalhe do instrumento, com utilizador, escala, data, categoria, periodos, motivo e navegacao quando disponivel",
      "Historico de utilizacao paginado e preservado mesmo para instrumentos ou escalas inativos e removidos"
    ],
    technicalNotes: [
      "A categoria musical permanece independente da identificacao patrimonial do instrumento.",
      "As trocas preservam o historico e possuem protecao contra estado obsoleto e operacoes concorrentes."
    ]
  },
  {
    version: "0.2.1",
    title: "Evolucoes operacionais planejadas",
    summary: "Ciclo de desenvolvimento para evoluir autorizacao ministerial, repertorios e organizacao de registros.",
    type: "PATCH",
    status: "PUBLISHED",
    releaseDate: "2026-07-26",
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
