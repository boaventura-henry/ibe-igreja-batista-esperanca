export type HelpAudience = "PUBLIC" | "MEMBER" | "ADMIN";

export type HelpStep = {
  title?: string;
  description: string;
};

export type HelpArticle = {
  id: string;
  title: string;
  description: string;
  category: string;
  audience: HelpAudience;
  permissionCodes?: string[];
  keywords: string[];
  steps: HelpStep[];
  notes?: string[];
  relatedArticleIds?: string[];
};

export const helpArticles: HelpArticle[] = [
  {
    id: "acessar-sistema",
    title: "Como acessar o sistema",
    description: "Entre usando o telefone ou CPF cadastrado e sua senha.",
    category: "Primeiros passos",
    audience: "PUBLIC",
    keywords: ["login", "entrar", "acesso", "telefone", "cpf"],
    steps: [
      { description: "Abra a tela de login." },
      { description: "Informe seu telefone ou CPF no campo de identificação." },
      { description: "Digite sua senha e clique em Acessar dashboard." }
    ],
    relatedArticleIds: ["mostrar-senha", "problemas-login"]
  },
  {
    id: "login-telefone-cpf",
    title: "Como usar telefone ou CPF no login",
    description: "O login principal usa o telefone ou CPF associados à sua conta.",
    category: "Acesso e senha",
    audience: "PUBLIC",
    keywords: ["telefone", "cpf", "login", "usuario"],
    steps: [
      { description: "Digite o telefone usado no cadastro ou o CPF, com ou sem pontuação." },
      { description: "Informe a senha e tente entrar novamente." }
    ],
    notes: ["O e-mail é uma informação cadastral e não é o identificador principal do login."],
    relatedArticleIds: ["recuperar-senha", "problemas-login"]
  },
  {
    id: "mostrar-senha",
    title: "Como mostrar ou ocultar a senha",
    description: "Use o botão com o ícone de olho ao lado de um campo de senha.",
    category: "Acesso e senha",
    audience: "PUBLIC",
    keywords: ["senha", "mostrar", "ocultar", "olho"],
    steps: [
      { description: "Localize o botão de olho dentro do campo de senha." },
      { description: "Clique para mostrar a senha digitada." },
      { description: "Clique novamente para ocultá-la." }
    ],
    notes: ["A senha começa sempre oculta."]
  },
  {
    id: "solicitar-acesso",
    title: "Como solicitar acesso",
    description: "Envie seus dados pela página pública Solicitar acesso.",
    category: "Primeiros passos",
    audience: "PUBLIC",
    keywords: ["solicitar", "acesso", "cadastro", "senha"],
    steps: [
      { description: "Na tela de login, clique em Solicitar acesso." },
      { description: "Preencha os dados obrigatórios e crie uma senha de pelo menos 6 caracteres." },
      { description: "Clique em Enviar solicitacao e aguarde a análise." }
    ],
    notes: ["O envio não inicia a sessão automaticamente. A solicitação pode ser aprovada ou ficar pendente."]
  },
  {
    id: "recuperar-senha",
    title: "Como recuperar a senha",
    description: "Solicite a recuperação usando o telefone ou CPF usado no login.",
    category: "Acesso e senha",
    audience: "PUBLIC",
    keywords: ["recuperar", "senha", "esqueci", "telefone", "cpf"],
    steps: [
      { description: "Na tela de login, clique em Esqueci minha senha." },
      { description: "Informe o telefone ou CPF e os dados opcionais solicitados." },
      { description: "Envie a solicitação e aguarde a avaliação da equipe." }
    ],
    notes: ["A resposta pública não confirma se existe uma conta para proteger seus dados."]
  },
  {
    id: "trocar-senha-temporaria",
    title: "Como trocar uma senha temporária",
    description: "A senha temporária precisa ser substituída no primeiro acesso.",
    category: "Acesso e senha",
    audience: "PUBLIC",
    keywords: ["senha temporaria", "trocar", "primeiro acesso", "must change"],
    steps: [
      { description: "Entre com a senha temporária recebida." },
      { description: "Quando a tela Trocar senha aparecer, informe a senha atual." },
      { description: "Digite e confirme uma nova senha com pelo menos 6 caracteres." },
      { description: "Salve a alteração e entre novamente se for solicitado." }
    ],
    notes: ["As demais áreas ficam bloqueadas até a troca obrigatória ser concluída."]
  },
  {
    id: "problemas-login",
    title: "Problemas comuns de login",
    description: "Confira passos simples quando não conseguir entrar.",
    category: "Problemas comuns",
    audience: "PUBLIC",
    keywords: ["login", "erro", "senha", "cookies", "sessao"],
    steps: [
      { description: "Confira se o telefone ou CPF foi digitado corretamente." },
      { description: "Use o botão de mostrar senha para conferir a digitação." },
      { description: "Saia do sistema, feche as abas abertas e tente novamente." },
      { description: "Se necessário, limpe os dados do site no navegador e entre com a senha atual." },
      { description: "Se ainda não conseguir, use Esqueci minha senha ou Solicitar acesso." }
    ]
  },
  {
    id: "instalar-android",
    title: "Como instalar o aplicativo no Android",
    description: "Instale o IBE pelo Chrome usando a opção de instalação do navegador.",
    category: "Aplicativo no celular",
    audience: "PUBLIC",
    keywords: ["instalar", "android", "chrome", "aplicativo", "pwa"],
    steps: [
      { description: "Abra o endereço do sistema no Chrome." },
      { description: "Abra o menu do navegador e escolha Instalar app ou Adicionar à tela inicial." },
      { description: "Confirme a instalação e abra o IBE pelo ícone criado." }
    ]
  },
  {
    id: "instalar-iphone",
    title: "Como adicionar o aplicativo à tela inicial no iPhone",
    description: "Use o Safari para adicionar o IBE à tela inicial.",
    category: "Aplicativo no celular",
    audience: "PUBLIC",
    keywords: ["instalar", "iphone", "ios", "safari", "tela inicial", "pwa"],
    steps: [
      { description: "Abra o endereço do sistema no Safari." },
      { description: "Toque em Compartilhar." },
      { description: "Escolha Adicionar à Tela de Início e confirme." }
    ]
  },
  {
    id: "atualizar-aplicativo",
    title: "Como atualizar o aplicativo",
    description: "O sistema é atualizado quando uma nova versão é publicada.",
    category: "Aplicativo no celular",
    audience: "PUBLIC",
    keywords: ["atualizar", "versao", "aplicativo", "pwa"],
    steps: [
      { description: "Feche o aplicativo e abra-o novamente quando houver uma nova versão." },
      { description: "Se a tela antiga continuar, atualize a página no navegador ou remova e adicione o aplicativo novamente." }
    ]
  },
  {
    id: "acessar-ajuda",
    title: "Como acessar a Central de Ajuda",
    description: "A ajuda pode ser aberta pelo login, pelo menu administrativo ou pelo Portal.",
    category: "Primeiros passos",
    audience: "PUBLIC",
    keywords: ["ajuda", "manual", "central", "duvida"],
    steps: [
      { description: "Clique em Ajuda na tela de login ou no menu da área em que você está." },
      { description: "Pesquise uma palavra ou escolha uma categoria." },
      { description: "Abra um artigo para ver o passo a passo e os assuntos relacionados." }
    ]
  },
  {
    id: "portal-acesso",
    title: "Como acessar o Portal do Membro",
    description: "O Portal reúne suas escalas, cadastro, ministérios, eventos e avisos.",
    category: "Portal do Membro",
    audience: "MEMBER",
    permissionCodes: ["memberPortal.view"],
    keywords: ["portal", "membro", "inicio"],
    steps: [
      { description: "Entre no sistema com seu telefone ou CPF." },
      { description: "Abra Portal do Membro no menu ou acesse a área Portal." }
    ],
    relatedArticleIds: ["portal-cadastro", "minhas-escalas"]
  },
  {
    id: "portal-cadastro",
    title: "Como alterar meus dados",
    description: "No Portal, você pode atualizar os dados permitidos do seu próprio cadastro.",
    category: "Meu cadastro",
    audience: "MEMBER",
    permissionCodes: ["memberPortal.updateProfile"],
    keywords: ["portal", "cadastro", "apelido", "telefone", "email"],
    steps: [
      { description: "Abra Meu Cadastro no menu do Portal." },
      { description: "Clique para editar os dados disponíveis, como apelido e contatos." },
      { description: "Revise as informações e salve." }
    ],
    notes: ["Você só pode alterar os dados da sua própria conta."]
  },
  {
    id: "portal-usuario",
    title: "Como alterar meus dados de usuário",
    description: "Gerencie telefone, e-mail e senha em Meu Usuário.",
    category: "Meu cadastro",
    audience: "MEMBER",
    permissionCodes: ["memberAccount.view"],
    keywords: ["meu usuario", "senha", "telefone", "email", "portal"],
    steps: [
      { description: "Abra Meu Usuário no menu do Portal." },
      { description: "Atualize os dados permitidos e salve." },
      { description: "Para trocar a senha, informe a senha atual, a nova senha e a confirmação." }
    ],
    relatedArticleIds: ["problemas-login"]
  },
  {
    id: "notificacoes-o-que-sao",
    title: "O que são notificações",
    description: "Notificações ajudam a avisar sobre atualizações importantes do sistema no dispositivo autorizado.",
    category: "Notificações",
    audience: "MEMBER",
    permissionCodes: ["memberAccount.view"],
    keywords: ["notificacoes", "push", "avisos", "celular"],
    steps: [
      { description: "Nesta primeira versão, a tela permite ativar o dispositivo e testar o recebimento." },
      { description: "O sistema não armazena o conteúdo detalhado das notificações nesta fase." }
    ]
  },
  {
    id: "notificacoes-ativar",
    title: "Como ativar notificações",
    description: "Ative as notificações somente depois de clicar no botão de ativação.",
    category: "Notificações",
    audience: "MEMBER",
    permissionCodes: ["memberAccount.view"],
    keywords: ["notificacoes", "ativar", "permitir", "meu usuario"],
    steps: [
      { description: "Abra Meu Usuário no Portal." },
      { description: "Na seção Notificações, clique em Ativar notificações." },
      { description: "Leia a explicação e permita as notificações no navegador." }
    ]
  },
  {
    id: "notificacoes-android",
    title: "Como ativar notificações no Android",
    description: "No Android, use o Chrome ou o aplicativo instalado pelo PWA.",
    category: "Notificações",
    audience: "MEMBER",
    permissionCodes: ["memberAccount.view"],
    keywords: ["notificacoes", "android", "chrome", "pwa"],
    steps: [
      { description: "Abra o IBE no Chrome ou pelo ícone instalado na tela inicial." },
      { description: "Acesse Meu Usuário e toque em Ativar notificações." },
      { description: "Permita o acesso quando o navegador solicitar." }
    ]
  },
  {
    id: "notificacoes-iphone",
    title: "Como ativar notificações no iPhone",
    description: "No iPhone ou iPad, a disponibilidade depende do suporte do navegador e do PWA instalado.",
    category: "Notificações",
    audience: "MEMBER",
    permissionCodes: ["memberAccount.view"],
    keywords: ["notificacoes", "iphone", "ipad", "ios", "pwa"],
    steps: [
      { description: "Adicione o IBE à Tela de Início pelo Safari quando essa opção estiver disponível." },
      { description: "Abra o IBE pelo ícone instalado, acesse Meu Usuário e toque em Ativar notificações." },
      { description: "Permita o acesso quando o dispositivo solicitar." }
    ],
    notes: ["O suporte pode variar entre versões do iOS e navegadores."]
  },
  {
    id: "notificacoes-teste",
    title: "Como enviar uma notificação de teste",
    description: "Envie um teste somente para os seus próprios dispositivos inscritos.",
    category: "Notificações",
    audience: "MEMBER",
    permissionCodes: ["memberAccount.view"],
    keywords: ["notificacoes", "teste", "enviar", "portal"],
    steps: [
      { description: "Abra Meu Usuário e confirme que as notificações estão ativadas." },
      { description: "Clique em Enviar notificação de teste." },
      { description: "Confira a notificação e toque nela para abrir o Portal." }
    ]
  },
  {
    id: "notificacoes-desativar",
    title: "Como desativar neste dispositivo",
    description: "Você pode remover a inscrição técnica do dispositivo atual sem remover outros dispositivos.",
    category: "Notificações",
    audience: "MEMBER",
    permissionCodes: ["memberAccount.view"],
    keywords: ["notificacoes", "desativar", "remover", "dispositivo"],
    steps: [
      { description: "Abra Meu Usuário no dispositivo que deseja desativar." },
      { description: "Clique em Desativar neste dispositivo." },
      { description: "A preferência geral pode ser desligada separadamente para impedir novos envios." }
    ]
  },
  {
    id: "notificacoes-permissao-negada",
    title: "O que fazer quando a permissão foi negada",
    description: "Quando a permissão foi negada, o navegador precisa ser ajustado manualmente.",
    category: "Notificações",
    audience: "MEMBER",
    permissionCodes: ["memberAccount.view"],
    keywords: ["notificacoes", "negada", "permissao", "configuracoes"],
    steps: [
      { description: "Abra as configurações de notificações do navegador para o site do IBE." },
      { description: "Libere a permissão e volte a Meu Usuário." },
      { description: "Clique em Ativar notificações novamente quando o navegador permitir." }
    ]
  },
  {
    id: "notificacoes-nao-recebida-permissao",
    title: "Por que não recebi uma notificação",
    description: "Confira o dispositivo, a permissão e a preferência geral antes de tentar novamente.",
    category: "Notificações",
    audience: "MEMBER",
    permissionCodes: ["memberAccount.view"],
    keywords: ["notificacoes", "nao recebi", "teste", "dispositivo"],
    steps: [
      { description: "Confirme que o dispositivo aparece como inscrito em Meu Usuário." },
      { description: "Verifique se a permissão do navegador está concedida e se Receber notificações push está ativo." },
      { description: "Envie um novo teste com o aplicativo aberto ou instalado no dispositivo compatível." }
    ],
    notes: ["Nesta primeira versão, não existem disparos automáticos de escalas ou comunicados."]
  },
  {
    id: "minhas-escalas",
    title: "Como visualizar minhas escalas",
    description: "Veja as escalas em que você participa e responda quando permitido.",
    category: "Escalas",
    audience: "MEMBER",
    permissionCodes: ["mySchedule.view"],
    keywords: ["escalas", "minhas escalas", "confirmar", "recusar"],
    steps: [
      { description: "Abra Minhas Escalas no menu do Portal." },
      { description: "Confira data, horário, ministério, função e local." },
      { description: "Use Confirmar presença ou Não poderei participar quando os botões estiverem disponíveis." }
    ],
    relatedArticleIds: ["repertorio-portal"]
  },
  {
    id: "repertorio-portal",
    title: "Como visualizar o repertório",
    description: "Membros escalados podem consultar músicas, tons e materiais da escala.",
    category: "Escalas",
    audience: "MEMBER",
    permissionCodes: ["mySchedule.view"],
    keywords: ["repertorio", "musica", "tom", "youtube", "material"],
    steps: [
      { description: "Abra a escala em Minhas Escalas." },
      { description: "Clique em Ver repertório." },
      { description: "Use os links YouTube ou Material quando existirem." }
    ]
  },
  {
    id: "avisos-portal",
    title: "Como visualizar e marcar comunicados como lidos",
    description: "Consulte os avisos publicados para o Portal e marque cada um como lido.",
    category: "Comunicados",
    audience: "MEMBER",
    permissionCodes: ["portalAnnouncement.view"],
    keywords: ["avisos", "comunicados", "lido", "portal"],
    steps: [
      { description: "Abra Avisos no menu do Portal." },
      { description: "Leia o comunicado desejado." },
      { description: "Clique em Marcar como lido quando essa opção estiver disponível." }
    ]
  },
  {
    id: "contribuicoes-portal",
    title: "Como visualizar e exportar minhas contribuições",
    description: "Consulte somente suas contribuições disponíveis no Portal.",
    category: "Financeiro e contribuições",
    audience: "MEMBER",
    permissionCodes: ["memberContribution.view"],
    keywords: ["contribuicoes", "dizimos", "financeiro", "exportar"],
    steps: [
      { description: "Abra Minhas Contribuições no Portal." },
      { description: "Use os filtros disponíveis para consultar os lançamentos." },
      { description: "Escolha a opção de exportação quando precisar de um arquivo." }
    ],
    notes: ["A área mostra apenas contribuições do membro logado."]
  },
  {
    id: "aniversariantes-portal",
    title: "Como visualizar aniversariantes",
    description: "O Portal mostra aniversariantes do dia, da semana e do mês.",
    category: "Portal do Membro",
    audience: "MEMBER",
    permissionCodes: ["memberPortal.view"],
    keywords: ["aniversariantes", "hoje", "mes", "semana"],
    steps: [
      { description: "Abra o início do Portal." },
      { description: "Consulte os cards Aniversariante do Dia, Aniversariantes da Semana e do mês." }
    ]
  },
  {
    id: "membros-admin",
    title: "Como consultar membros",
    description: "Consulte a lista de membros e use os filtros disponíveis.",
    category: "Membros",
    audience: "ADMIN",
    permissionCodes: ["member.view"],
    keywords: ["membros", "cadastro", "apelido", "foto", "cpf"],
    steps: [
      { description: "Abra Membros no menu administrativo." },
      { description: "Pesquise por nome, apelido, CPF ou outros filtros disponíveis." },
      { description: "Abra um registro para consultar seus dados quando sua permissão permitir." }
    ],
    notes: ["O apelido é opcional. Relatórios continuam usando o nome completo oficial."]
  },
  {
    id: "cadastrar-membro",
    title: "Como cadastrar ou editar um membro",
    description: "Cadastre ou atualize membros quando seu perfil possuir as permissões correspondentes.",
    category: "Membros",
    audience: "ADMIN",
    permissionCodes: ["member.create", "member.update"],
    keywords: ["membros", "cadastrar", "editar", "apelido", "foto"],
    steps: [
      { description: "Abra Membros no menu administrativo." },
      { description: "Clique em Novo membro ou abra um registro existente." },
      { description: "Preencha os dados, incluindo o apelido opcional, e salve." }
    ],
    notes: ["A exclusão é lógica e exige a permissão específica de exclusão."]
  },
  {
    id: "usuarios-admin",
    title: "Como consultar usuários",
    description: "Consulte as contas cadastradas conforme a permissão disponível.",
    category: "Usuários e permissões",
    audience: "ADMIN",
    permissionCodes: ["user.view"],
    keywords: ["usuarios", "permissoes", "perfil", "senha", "bloquear"],
    steps: [
      { description: "Abra Usuários para consultar as contas cadastradas." },
      { description: "Abra uma conta para consultar os dados permitidos." }
    ]
  },
  {
    id: "criar-usuario",
    title: "Como criar ou atualizar um usuário",
    description: "Crie contas e altere dados de acesso somente quando seu perfil permitir.",
    category: "Usuários e permissões",
    audience: "ADMIN",
    permissionCodes: ["user.create", "user.update"],
    keywords: ["usuarios", "criar", "editar", "senha", "perfil"],
    steps: [
      { description: "Abra Usuários no menu administrativo." },
      { description: "Clique em Novo usuário ou abra uma conta existente." },
      { description: "Informe usuário, senha, vínculo e perfil e salve." }
    ]
  },
  {
    id: "perfis-acesso",
    title: "Como consultar perfis de acesso",
    description: "Consulte os perfis e as permissões disponíveis para sua conta.",
    category: "Usuários e permissões",
    audience: "ADMIN",
    permissionCodes: ["accessRole.view"],
    keywords: ["perfil", "perfis", "acesso", "permissao", "rbac"],
    steps: [
      { description: "Abra Perfis de Acesso no menu administrativo." },
      { description: "Selecione um perfil para consultar as permissões associadas." }
    ]
  },
  {
    id: "ministerios-admin",
    title: "Como consultar ministérios",
    description: "Consulte ministérios, lideranças e a ordem de exibição.",
    category: "Ministérios",
    audience: "ADMIN",
    permissionCodes: ["ministry.view"],
    keywords: ["ministerios", "lider", "vice", "ordem", "membros"],
    steps: [
      { description: "Abra Ministérios no menu administrativo." },
      { description: "Abra um ministério para consultar seus dados." }
    ],
    relatedArticleIds: ["vincular-ministerio"]
  },
  {
    id: "gerenciar-ministerios",
    title: "Como cadastrar e organizar ministérios",
    description: "Cadastre ministérios, defina lideranças e mantenha a ordem de exibição.",
    category: "Ministérios",
    audience: "ADMIN",
    permissionCodes: ["ministry.create", "ministry.update"],
    keywords: ["ministerios", "cadastrar", "lider", "vice", "ordem automatica"],
    steps: [
      { description: "Abra Ministérios no menu administrativo." },
      { description: "Clique em Novo ministério ou abra um registro existente." },
      { description: "Informe os dados, lideranças e display order e salve." }
    ],
    relatedArticleIds: ["vincular-ministerio"]
  },
  {
    id: "vincular-ministerio",
    title: "Como vincular um membro a um ministério",
    description: "Registre a participação atual ou histórica de um membro.",
    category: "Ministérios",
    audience: "ADMIN",
    permissionCodes: ["memberMinistry.create", "memberMinistry.update"],
    keywords: ["vinculo", "membro", "ministerio", "historico"],
    steps: [
      { description: "Abra Membros x Ministérios." },
      { description: "Clique para criar um vínculo e selecione o membro e o ministério." },
      { description: "Informe função, datas e status e salve." }
    ]
  },
  {
    id: "escalas-admin",
    title: "Como consultar escalas",
    description: "Consulte escalas e seus detalhes conforme as permissões disponíveis.",
    category: "Escalas",
    audience: "ADMIN",
    permissionCodes: ["schedule.view"],
    keywords: ["escala", "participante", "funcao", "confirmar", "substituicao"],
    steps: [
      { description: "Abra Escalas para consultar as escalas cadastradas." },
      { description: "Abra os detalhes para consultar participantes, funções e repertório." }
    ],
    relatedArticleIds: ["repertorio-admin"]
  },
  {
    id: "criar-escala",
    title: "Como criar e publicar uma escala",
    description: "Crie escalas e acompanhe respostas quando seu perfil possuir as permissões correspondentes.",
    category: "Escalas",
    audience: "ADMIN",
    permissionCodes: ["schedule.create", "schedule.update", "schedule.publish"],
    keywords: ["escala", "criar", "participante", "publicar", "funcao"],
    steps: [
      { description: "Abra Escalas e clique para criar uma escala." },
      { description: "Selecione o ministério, data, horário e participantes válidos." },
      { description: "Salve e publique a escala quando estiver pronta." }
    ],
    relatedArticleIds: ["repertorio-admin"]
  },
  {
    id: "repertorio-admin",
    title: "Como adicionar músicas ao repertório",
    description: "Monte o repertório diretamente nos detalhes de uma escala.",
    category: "Músicas e repertório",
    audience: "ADMIN",
    permissionCodes: ["song.view", "schedule.update"],
    keywords: ["musica", "repertorio", "tom", "ministro", "youtube", "material"],
    steps: [
      { description: "Abra Escalas e entre nos detalhes da escala." },
      { description: "Na seção Repertório, clique em Adicionar música." },
      { description: "Pesquise pelo título ou artista e selecione uma música." },
      { description: "Preencha tom, ministro, links e observações e salve." },
      { description: "Use as ações disponíveis para mover, copiar, imprimir ou enviar o texto para WhatsApp." }
    ],
    relatedArticleIds: ["escalas-admin"]
  },
  {
    id: "eventos-admin",
    title: "Como consultar eventos",
    description: "Consulte eventos e seus detalhes conforme sua permissão.",
    category: "Eventos",
    audience: "ADMIN",
    permissionCodes: ["event.view"],
    keywords: ["eventos", "publicar", "cancelar", "concluir", "inscricao"],
    steps: [
      { description: "Abra Eventos no menu administrativo." },
      { description: "Abra um evento para consultar seus dados." }
    ]
  },
  {
    id: "cadastrar-musica",
    title: "Como cadastrar uma música",
    description: "Cadastre músicas novas quando seu perfil possuir a permissão correspondente.",
    category: "Músicas e repertório",
    audience: "ADMIN",
    permissionCodes: ["song.create"],
    keywords: ["musica", "cadastrar", "titulo", "artista", "youtube", "tom"],
    steps: [
      { description: "Abra os detalhes de uma escala e entre em Repertório." },
      { description: "Clique em Adicionar música e depois em Nova música." },
      { description: "Informe título, artista, YouTube e tom padrão e salve." }
    ]
  },
  {
    id: "gerenciar-eventos",
    title: "Como criar e publicar eventos",
    description: "Cadastre e altere eventos quando seu perfil possuir as permissões necessárias.",
    category: "Eventos",
    audience: "ADMIN",
    permissionCodes: ["event.create", "event.update", "event.publish"],
    keywords: ["eventos", "criar", "editar", "publicar", "cancelar", "concluir"],
    steps: [
      { description: "Abra Eventos no menu administrativo." },
      { description: "Clique em Novo evento ou abra um registro existente." },
      { description: "Preencha os dados e use as ações de publicação disponíveis para sua conta." }
    ]
  },
  {
    id: "comunicados-admin",
    title: "Como consultar comunicados",
    description: "Consulte comunicados e seus detalhes conforme sua permissão.",
    category: "Comunicados",
    audience: "ADMIN",
    permissionCodes: ["announcement.view"],
    keywords: ["comunicados", "publicar", "arquivar", "portal", "ministerio"],
    steps: [
      { description: "Abra Comunicados." },
      { description: "Abra um comunicado para consultar o conteúdo, o público-alvo e o período de exibição." }
    ]
  },
  {
    id: "gerenciar-comunicados",
    title: "Como criar e publicar comunicados",
    description: "Crie, publique e arquive comunicados quando seu perfil possuir as permissões necessárias.",
    category: "Comunicados",
    audience: "ADMIN",
    permissionCodes: ["announcement.create", "announcement.update", "announcement.publish", "announcement.archive"],
    keywords: ["comunicados", "criar", "publicar", "arquivar", "portal", "ministerio"],
    steps: [
      { description: "Abra Comunicados." },
      { description: "Crie o conteúdo e escolha o público-alvo, início e expiração quando necessários." },
      { description: "Salve como rascunho ou publique conforme sua permissão." },
      { description: "Arquive o comunicado quando ele não precisar mais aparecer." }
    ]
  },
  {
    id: "financeiro-admin",
    title: "Como consultar lançamentos financeiros",
    description: "Consulte lançamentos financeiros conforme a permissão disponível.",
    category: "Financeiro e contribuições",
    audience: "ADMIN",
    permissionCodes: ["financialEntry.view"],
    keywords: ["financeiro", "lancamentos", "categorias", "fechamentos", "contribuicoes"],
    steps: [
      { description: "Abra Lançamentos financeiros no menu administrativo." },
      { description: "Use os filtros disponíveis para consultar informações." }
    ],
    notes: ["Os relatórios e telas mostram somente os dados permitidos pelo seu perfil."]
  },
  {
    id: "relatorios-admin",
    title: "Como consultar relatórios",
    description: "Consulte relatórios administrativos conforme sua permissão.",
    category: "Relatórios",
    audience: "ADMIN",
    permissionCodes: ["report.view"],
    keywords: ["relatorio", "pdf", "xlsx", "csv", "exportar", "filtro"],
    steps: [
      { description: "Abra Relatórios." },
      { description: "Escolha o catálogo, aplique os filtros e visualize os resultados." }
    ],
    notes: ["Documentos oficiais usam o nome completo cadastrado."]
  },
  {
    id: "exportar-relatorios",
    title: "Como exportar relatórios",
    description: "Exporte relatórios nos formatos disponíveis quando seu perfil possuir a permissão correspondente.",
    category: "Relatórios",
    audience: "ADMIN",
    permissionCodes: ["report.view", "report.export"],
    keywords: ["relatorio", "pdf", "xlsx", "csv", "exportar"],
    steps: [
      { description: "Abra Relatórios e escolha o catálogo desejado." },
      { description: "Aplique os filtros necessários antes de exportar." },
      { description: "Escolha o formato de exportação permitido para sua conta." }
    ],
    notes: ["Documentos oficiais usam o nome completo cadastrado."]
  },
  {
    id: "notificacoes-assistente",
    title: "Como configurar notificacoes passo a passo",
    description: "Siga as quatro etapas em Meu Usuario para registrar seu dispositivo e confirmar um teste.",
    category: "Notificacoes",
    audience: "MEMBER",
    keywords: ["notificacoes", "push", "permissao", "dispositivo", "teste"],
    steps: [
      { description: "Abra Portal > Meu Usuario e encontre a secao Notificacoes." },
      { description: "Clique em Ativar notificacoes e permita o navegador quando solicitado." },
      { description: "Envie uma notificacao de teste e confirme se ela apareceu no dispositivo." },
      { description: "Se voce nao receber, abra as instrucoes do seu ambiente e tente novamente." }
    ],
    notes: ["Nesta fase, o envio automatico de escalas, comunicados e eventos ainda nao esta ativo."]
  },
  {
    id: "notificacoes-nao-recebida",
    title: "Permissao concedida, mas nao recebi",
    description: "Confira as configuracoes de notificacao do navegador e do dispositivo antes de testar novamente.",
    category: "Notificacoes",
    audience: "MEMBER",
    keywords: ["notificacoes", "nao apareceu", "teste", "bloqueio", "permissao"],
    steps: [
      { description: "Confirme que a permissao do site esta liberada no navegador." },
      { description: "Confira se as notificacoes gerais do sistema estao ativas." },
      { description: "Volte a Meu Usuario e clique em Testar novamente." }
    ]
  },
  {
    id: "notificacoes-windows",
    title: "Como liberar notificacoes no Windows",
    description: "Veja onde liberar notificacoes para o navegador usado no Windows.",
    category: "Notificacoes",
    audience: "MEMBER",
    keywords: ["notificacoes", "windows", "chrome", "edge"],
    steps: [
      { description: "Abra Configuracoes do Windows > Sistema > Notificacoes." },
      { description: "Permita notificacoes para o Chrome ou Edge." },
      { description: "Confira tambem a permissao deste site no navegador." }
    ]
  },
  {
    id: "notificacoes-android-permissao",
    title: "Como liberar notificacoes no Android",
    description: "Veja onde liberar notificacoes no Chrome, Edge ou aplicativo instalado.",
    category: "Notificacoes",
    audience: "MEMBER",
    keywords: ["notificacoes", "android", "chrome", "edge", "pwa"],
    steps: [
      { description: "Abra Configuracoes > Aplicativos." },
      { description: "Selecione o navegador ou aplicativo instalado do IBE." },
      { description: "Abra Notificacoes e permita o recebimento." }
    ]
  },
  {
    id: "notificacoes-iphone-permissao",
    title: "Como liberar notificacoes no iPhone",
    description: "No iPhone, as notificacoes do PWA dependem da instalacao na Tela de Inicio.",
    category: "Notificacoes",
    audience: "MEMBER",
    keywords: ["notificacoes", "iphone", "ipad", "pwa", "safari"],
    steps: [
      { description: "Confirme que o IBE foi adicionado a Tela de Inicio." },
      { description: "Abra o IBE pelo icone instalado." },
      { description: "Em Ajustes > Notificacoes, permita as notificacoes do aplicativo." }
    ]
  },
  {
    id: "notificacoes-macos",
    title: "Como liberar notificacoes no macOS",
    description: "Permita notificacoes para o navegador usado no Mac.",
    category: "Notificacoes",
    audience: "MEMBER",
    keywords: ["notificacoes", "macos", "mac", "safari", "chrome"],
    steps: [
      { description: "Abra Ajustes do Sistema > Notificacoes." },
      { description: "Selecione o navegador usado para acessar o IBE." },
      { description: "Permita notificacoes e tente o teste novamente." }
    ]
  },
  {
    id: "notificacoes-desativar-dispositivo",
    title: "Como desativar neste dispositivo",
    description: "Remova somente o dispositivo atual sem afetar os demais dispositivos da conta.",
    category: "Notificacoes",
    audience: "MEMBER",
    keywords: ["notificacoes", "desativar", "dispositivo", "remover"],
    steps: [
      { description: "Abra Portal > Meu Usuario > Notificacoes." },
      { description: "Clique em Desativar neste dispositivo." },
      { description: "Para pausar todos os dispositivos, desative a preferencia geral da conta." }
    ]
  },
  {
    id: "notificacoes-pausar-conta",
    title: "Diferenca entre desativar o dispositivo e pausar a conta",
    description: "Entenda as duas acoes disponiveis para controlar suas notificacoes.",
    category: "Notificacoes",
    audience: "MEMBER",
    keywords: ["notificacoes", "pausar", "conta", "dispositivo", "preferencia"],
    steps: [
      { description: "Desativar neste dispositivo remove somente o navegador atual." },
      { description: "Pausar a conta interrompe os envios para todos os dispositivos, sem remove-los." },
      { description: "Ao reativar a conta, dispositivos ainda validos podem voltar a receber notificacoes." }
    ]
  }
];
