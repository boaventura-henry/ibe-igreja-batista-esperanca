# Escopo administrativo de escalas

## Decisao

O Perfil de Acesso possui um `ScheduleScope` independente das permissoes:

- `ALL`: acesso administrativo a escalas de qualquer ministerio.
- `MEMBER_MINISTRIES`: acesso administrativo somente a escalas cujo `Schedule.ministryId` pertence aos vinculos ministeriais vigentes do `Member` associado ao usuario.

Permissao e escopo cumprem responsabilidades diferentes. A permissao autoriza uma operacao, enquanto o escopo limita os registros sobre os quais a operacao pode atuar. O escopo nunca concede uma permissao ausente.

## Vinculo vigente

O resolver considera exclusivamente `MemberMinistry` com:

- `memberId` igual ao `User.memberId` autenticado;
- `status = ACTIVE`;
- `exitDate = null`;
- `deletedAt = null`.

Participantes da escala, ministerios de outros participantes, autoria da escala e `Ministry.leaderMemberId` nao concedem acesso. A regra usa somente o vinculo do usuario e o `Schedule.ministryId`, evitando propagacao indireta de privilegios.

## Escalas administrativas e pessoais

O escopo se aplica somente as superficies administrativas. Portal do Membro e Minhas Escalas continuam consultando `ScheduleMember.memberId = session.user.memberId`.

- `ALL` nao amplia as escalas pessoais.
- `MEMBER_MINISTRIES` nao remove uma escala pessoal em que o membro foi incluido.
- As duas regras sao independentes.

## Superficies administrativas protegidas

O mesmo `ScheduleAccessContext` limita todas as superficies administrativas que exibem ou manipulam dados derivados de escalas:

- CRUD e acoes das APIs administrativas de Escalas;
- participantes, membros disponiveis, repertorio, copia e impressao;
- relatorio de Escalas, tanto visualizacao quanto exportacao;
- widget de proximas escalas do Dashboard Administrativo;
- historico de escalas no perfil administrativo do membro.

Relatorios e Dashboard aplicam o filtro no `where` do Prisma. No perfil do membro, somente a relacao `scheduleMembers` e filtrada; os demais dados cadastrais continuam sujeitos exclusivamente a permissao `member.view`.

## Ausencia de vinculo

Um usuario restrito sem `memberId`, ou cujo membro nao possua vinculos vigentes, recebe uma lista vazia de ministerios autorizados. Listagens devem retornar vazias. Consultas e operacoes por ID devem responder como registro nao encontrado.

## Protecao contra IDOR

Consultas administrativas por ID devem combinar `id`, `deletedAt = null` e o filtro produzido por `buildScheduleScopeWhere()`. Uma escala existente fora do escopo deve resultar em `404`, e nao `403`, para que sua existencia nao seja revelada.

## Compatibilidade

A migration atribui `ALL` a todos os perfis existentes antes de alterar o default para `MEMBER_MINISTRIES`. Os perfis oficiais do seed declaram o escopo explicitamente. Assim, a implantacao da infraestrutura nao reduz silenciosamente acessos existentes, enquanto novos perfis adotam o principio do menor privilegio.

## Configuracao no Perfil de Acesso

A tela de Perfis de Acesso permite configurar o campo **Escopo Administrativo das Escalas**:

- **Todos os ministerios (`ALL`)**: o usuario podera visualizar e administrar escalas de qualquer ministerio.
- **Apenas ministerios do membro (`MEMBER_MINISTRIES`)**: o usuario visualizara apenas escalas dos ministerios aos quais o `Member` vinculado ao seu usuario possuir vinculo vigente.

Novos perfis iniciam explicitamente com `MEMBER_MINISTRIES`. Ao editar um perfil existente, a interface carrega e preserva exatamente o valor armazenado.

O campo configurado e resolvido uma unica vez por requisicao atraves de `requireScheduleAccess()`. A autorizacao resultante segue o fluxo `Route -> ScheduleAuthorization -> Service -> Repository -> Prisma`, sem filtragem em memoria ou caminhos administrativos paralelos.
