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
    version: "0.2.6",
    title: "Correcao da copia para WhatsApp",
    summary: "Correcao pontual do compartilhamento do repertorio das escalas.",
    type: "PATCH",
    status: "UNRELEASED",
    releaseDate: null,
    highlights: ["Corrigido o botao de copiar mensagem para WhatsApp nas escalas"]
  },
  {
    version: "0.2.5",
    title: "Multiplas funcoes em escalas",
    summary: "Participantes de escalas agora podem exercer e visualizar multiplas funcoes com consistencia no Administrativo, Portal e notificacoes.",
    type: "PATCH",
    status: "PUBLISHED",
    releaseDate: "2026-08-29",
    highlights: [
      "Participantes podem exercer multiplas funcoes na mesma escala",
      "O Administrativo permite selecionar e editar varias funcoes por participante",
      "Detalhes, historico, Portal e Minhas Escalas apresentam todas as funcoes atribuidas",
      "Instrumentos permanecem associados somente a participantes com a funcao Instrumento",
      "Notificacoes representam corretamente as multiplas funcoes sem duplicar destinatarios",
      "Ordenacao e sugestoes instrumentais foram adaptadas para a nova fonte de dados"
    ],
    technicalNotes: [
      "ScheduleMemberRoleAssignment passou a ser a fonte unica das funcoes de escala.",
      "A coluna ScheduleMember.role e seu indice legado foram removidos por rollout expand/contract.",
      "Confirmacao, recusa, substituicao, instrumentos, reminders e lifecycle foram preservados.",
      "Rollback deve utilizar runtime compativel com o schema pos-DROP ou uma correcao forward; runtimes que dependem de ScheduleMember.role nao sao seguros."
    ]
  },
  {
    version: "0.2.4",
    title: "Sugestao da ultima configuracao instrumental",
    summary: "A montagem das escalas agora pode aproveitar a ultima configuracao instrumental conhecida de cada instrumentista.",
    type: "PATCH",
    status: "PUBLISHED",
    releaseDate: "2026-08-22",
    highlights: [
      "Ao adicionar um instrumentista, o sistema sugere sua ultima categoria musical, origem e instrumento utilizados",
      "A sugestao tambem considera membros adicionados por excecao e pessoas sem vinculo atual com o Ministerio de Louvor",
      "Somente historicos instrumentais sao considerados; funcoes como backing e vocal nao geram sugestoes",
      "Instrumentos proprios utilizados anteriormente podem ser sugeridos",
      "Patrimonios atualmente indisponiveis nao sao selecionados automaticamente",
      "O lider pode revisar e alterar livremente todos os dados sugeridos antes de salvar"
    ]
  },
  {
    version: "0.2.3",
    title: "Correcao de acesso ao modulo de Instrumentos",
    summary: "O menu e as paginas de Instrumentos agora refletem as permissoes atuais do usuario com protecao reforcada de acesso.",
    type: "PATCH",
    status: "PUBLISHED",
    releaseDate: "2026-08-21",
    highlights: [
      "O menu de Instrumentos passa a refletir permissoes concedidas depois do inicio da sessao",
      "Revogacoes de acesso tambem sao aplicadas ao menu administrativo",
      "As paginas de listagem e detalhes de Instrumentos receberam protecao adicional de acesso",
      "A rota de Instrumentos foi incorporada ao fluxo de autenticacao do sistema"
    ]
  },
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
