# Sistema de notificacoes internas

## Objetivo

A Central de Notificacoes entrega atualizacoes pessoais dentro da aplicacao. Ela e
independente do canal Web Push existente: uma notificacao interna nao registra
dispositivo, nao envia Push e nao altera a preferencia `pushEnabled`.

## Tipos suportados

- `SCHEDULE_PUBLISHED`
- `SCHEDULE_REMINDER`
- `NOTICE_CREATED`
- `EVENT_CREATED`
- `BIRTHDAY`

As integracoes que criarao notificacoes a partir de Escalas, Comunicados, Eventos e
Aniversarios pertencem a Stories futuras.

## Arquitetura

O fluxo das APIs segue:

```text
Route -> requireCurrentUser -> Validator -> Service -> Repository -> Prisma
```

Routes e componentes nao acessam Prisma nem decidem elegibilidade.

## Catalogo central

`src/lib/notification-catalog.ts` e a fonte unica para metadados e regras estaticas
dos tipos de notificacao. Cada tipo registra:

- label;
- icone;
- suporte a lembrete;
- tipo e rota da entidade canonica;
- preferencia padrao;
- resolucao centralizada do destino.

Novos produtores nao devem manter mapas locais nem construir URLs manualmente.

Os valores permitidos para `entityType` sao `SCHEDULE`, `NOTICE`, `EVENT`, `MEMBER`,
`CONTRIBUTION`, `MINISTRY` e `USER`. O validator exige `entityType` e `entityId` em
conjunto e verifica se a entidade corresponde ao tipo da notificacao.

## Modelos

`Notification` guarda destinatario, conteudo textual, entidade relacionada,
override de rota interna, agendamento, validade, envio, leitura, ocultacao,
cancelamento e rastreabilidade operacional.

`InAppNotificationPreference` guarda a preferencia explicita de um usuario para um
tipo. A tabela tem nome proprio porque `NotificationPreference` ja pertence ao
modulo Web Push.

Quando nao existe preferencia persistida, o catalogo aplica os defaults:

- todos os tipos habilitados no canal interno;
- lembrete de escala com 24 horas de antecedencia.

O seed nao preenche preferencias para todos os usuarios.

## Ciclo de vida

Os estados sao derivados dos campos:

- agendada: `scheduledFor` preenchido e `sentAt` nulo;
- enviada: `sentAt` preenchido;
- nao lida: `readAt` nulo;
- lida: `readAt` preenchido;
- ocultada pelo usuario: `hiddenAt` preenchido;
- cancelada antes da entrega: `cancelledAt` preenchido.

`hiddenAt` afeta apenas a visualizacao do destinatario. `cancelledAt` representa
uma decisao operacional do sistema e somente se aplica a uma notificacao ainda nao
enviada. Durante a fase expand, `deletedAt` permanece como campo legado: a leitura
considera os dois contratos e ocultacao/cancelamento fazem dual-write para permitir
convivencia entre instancias antigas e novas. Os estados nao sao exclusao fisica.

## Referencia canonica e destino

Quando existe entidade relacionada e reconhecida, `entityType + entityId` e a
referencia oficial e o destino e calculado pelo resolvedor central. Durante a fase
expand, `actionUrl` e preservado e usado como fallback quando a referencia estiver
incompleta, for legada ou nao puder ser resolvida.

Novos produtores continuam proibidos de construir URLs quando informam entidade.
O fallback existe somente para compatibilidade dos registros anteriores e aceita
somente rotas internas iniciadas por `/`.

## Agendamento e validade

`scheduledFor` indica quando uma notificacao futura pode ser disponibilizada.
`expiresAt` indica o limite apos o qual ela perdeu seu significado e nao deve mais
ser entregue.

Uma notificacao imediata recebe `sentAt` na criacao. Uma notificacao futura guarda
`scheduledFor` e permanece com `sentAt = null`. O service oferece operacoes para
marcar IDs vencidos como enviados ou cancelar IDs ainda nao enviados. A marcacao
de envio recusa itens cujo `expiresAt` ja passou.

Esta Story nao inclui cron, worker ou consulta automatica de itens vencidos.

Datas sao persistidas em UTC. A interface converte a exibicao para
`America/Sao_Paulo`.

## Rastreabilidade operacional

`createdById` e opcional e possui relacionamento com `User` usando `onDelete:
SetNull`:

- `NULL`: notificacao gerada automaticamente;
- preenchido: acao que originou a notificacao foi iniciada por aquele usuario.

Esse campo nao participa de autorizacao. O destinatario continua sendo definido
exclusivamente por `userId`.

## Seguranca

- As APIs usam `requireCurrentUser()`.
- O `userId` e obtido somente da sessao.
- Leitura, alteracao e ocultacao sempre combinam `id` e `userId`.
- Um registro protegido retorna o mesmo `404` de um registro inexistente.
- Titulo e mensagem sao renderizados como texto React, sem HTML.

## Deduplicacao

O indice unico `(userId, deduplicationKey)` permanece como garantia contra
concorrencia. Chaves nulas permitem notificacoes independentes. Com chave
informada, duas tentativas para o mesmo usuario nao geram duplicidade.

Toda `deduplicationKey` deve ser:

- namespaced por dominio e evento;
- versionada com um segmento `vN`;
- deterministica para o mesmo fato e destinatario.

Formato contratual:

```text
<dominio>:<evento-opcional>:v<versao>:<identificadores-deterministicos>
```

Exemplos:

```text
schedule:published:v1:123:user456
schedule:reminder:v1:123:user456
birthday:v1:2026-07-27:user789
```

A versao deve mudar quando a regra que define a identidade do evento mudar.

## Criacao interna

`notificationService.create()` e `notificationService.createMany()` sao os pontos
centrais para futuras integracoes. Antes da gravacao eles:

1. validam o contrato;
2. descartam usuarios inativos;
3. resolvem preferencias efetivas pelo catalogo;
4. validam a referencia canonica ou o override interno;
5. aplicam a deduplicacao.

A criacao em lote consulta usuarios e preferencias em blocos e usa `createMany`,
evitando N+1. Nao existe endpoint generico para disparo administrativo.

## Retencao futura

Esta Story nao implementa limpeza. A politica operacional futura devera definir
janelas configuraveis e remover fisicamente, em lotes pequenos:

- notificacoes entregues antigas;
- notificacoes ocultadas apos a janela acordada;
- notificacoes canceladas;
- notificacoes expiradas que nunca foram entregues.

A limpeza deve ser observavel, preservar registros ainda necessarios ao produto e
considerar requisitos legais antes de definir prazos. Particionamento so deve ser
avaliado com base em volume e desempenho medidos.

`Notification` e uma caixa de entrada operacional e nao substitui uma trilha de
auditoria imutavel. Se auditoria permanente for exigida, ela deve possuir modelo e
politica de retencao proprios.

## APIs pessoais

- `GET /api/notifications`
- `PATCH /api/notifications/[id]/read`
- `PATCH /api/notifications/read-all`
- `DELETE /api/notifications/[id]`
- `GET /api/notification-preferences`
- `PUT /api/notification-preferences`

O `DELETE` preserva o contrato HTTP existente e, durante a fase expand, preenche
`hiddenAt` e `deletedAt` com o mesmo instante. As respostas de leitura usam
`Cache-Control: no-store`.

## Atualizacao automatica do contador de nao lidas

O sino compartilhado aparece na area administrativa e no Portal. Um controlador
unico por pagina consulta somente o contador de nao lidas a cada 30 segundos enquanto
a aplicacao esta visivel. As duas instancias responsivas do sino compartilham estado,
timer e request em andamento.

O polling e suspenso quando a aba fica oculta. Ao voltar a ficar visivel ou quando a
janela recebe foco, o contador e sincronizado imediatamente, com coalescing entre
eventos proximos. Abrir ou fechar o sino, carregar a Central e concluir leitura ou
ocultacao tambem solicita sincronizacao. Requests concorrentes usam single-flight e
uma mutacao ocorrida durante uma consulta agenda uma unica leitura posterior.

Falhas temporarias preservam o ultimo valor valido e aguardam o proximo ciclo normal.
Uma resposta `401` ou `403` encerra o timer daquela montagem. Focus,
`visibilitychange` ou uma interacao explicita podem fazer uma unica sondagem posterior;
se a sessao tiver sido renovada, o polling e retomado sem reload e, se continuar
invalida, permanece suspenso sem retry agressivo. Quando o ultimo consumidor e
desmontado, a request em andamento e abortada junto com timer e listeners.

Cada aba visivel possui seu proprio controlador e faz aproximadamente duas consultas
por minuto. Duas abas visiveis fazem cerca de quatro consultas por minuto e cinco abas,
cerca de dez. Abas ocultas nao consultam e sincronizam imediatamente ao retornar. Nao
existe coordenacao entre abas nesta fase: a decisao preserva a simplicidade, pois o
volume atual nao justifica `BroadcastChannel`, SharedWorker, WebSocket ou SSE.

O endpoint `GET /api/notifications/unread-count` usa `COUNT` no banco e nao trafega
conteudo, metadata ou paginacao. Web Push e badge do PWA permanecem explicitamente
fora deste escopo.

A Central possui filtros, paginacao, leitura individual ou em lote, ocultacao,
navegacao interna e preferencias. Atualizacao por WebSocket ou SSE continua fora do
escopo desta etapa.

## Limitacoes desta Story

- nao ha integracao com Escalas, Comunicados, Eventos ou Aniversarios;
- nao ha job para processar agendamentos ou retencao;
- nao ha envio por Push, e-mail, WhatsApp ou SMS;
- nao ha endpoint administrativo de envio livre;
- o Web Push existente permanece um canal independente.

## Testes

Execute:

```text
npm run test:notifications
```

A suite cobre validacao, ownership, defaults, inatividade, deduplicacao,
agendamento, validade, rastreabilidade, catalogo, resolucao de rotas, fallback
legado, lote sem N+1, leitura idempotente, dual-write, backfill preservador e
contratos das APIs.

A estrategia operacional de rollout esta em
`docs/notification-migration-expand-contract.md`.
