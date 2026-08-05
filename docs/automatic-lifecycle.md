# Encerramento automatico

O agendador externo chama o endpoint interno existente
`/api/internal/cron/schedule-reminders`. A rota autentica o `CRON_SECRET` e delega
uma unica execucao ao `scheduledJobsService`; nenhum processador possui endpoint
publico proprio.

## Fluxo operacional

```text
cron-job.org
    |
    v
GET /api/internal/cron/schedule-reminders
    |
    v
scheduledJobsService.run()
    |
    +-- ScheduleNotificationService.processPendingReminders()
    +-- LifecycleService.processExpiredSchedules()
    +-- LifecycleService.processExpiredEvents()
    +-- LifecycleService.processExpiredAnnouncements()
             |
             v
        transacao propria
             |
        advisory xact lock proprio
             |
        SELECT ... FOR UPDATE SKIP LOCKED LIMIT 100
             |
        update condicional e commit independente
```

Os quatro processadores sao disparados juntos com `Promise.allSettled`. A ordem
na lista e lembretes, escalas, eventos e comunicados, mas nao existe dependencia
semantica de ordem: eles trabalham em tabelas e locks distintos. A execucao somente
retorna sucesso quando todos terminam. Se um falhar, os demais ainda sao aguardados;
ao final o primeiro erro e propagado para a rota e as transacoes ja confirmadas nao
sao desfeitas. Alterar isso para `Promise.all` faria uma rejeicao encerrar a espera
do orquestrador antes de todos os resultados serem observados.

| Processador | Objetivo | Frequencia | Advisory lock | Transacao | Retry | Gera notificacao | Cancela reminder |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| Reminders | Entregar ou invalidar lembretes vencidos | Agenda externa | 1 | Propria | Ate 3 em falha transitoria | Entrega a notificacao ja agendada | Sim, se inelegivel |
| Escalas | Concluir escalas publicadas vencidas | Mesma chamada | 2 | Propria | Ate 3 em falha transitoria | Nao | Sim, apenas pendentes |
| Eventos | Arquivar eventos vencidos | Mesma chamada | 3 | Propria | Ate 3 em falha transitoria | Nao | Nao |
| Comunicados | Arquivar comunicados expirados | Mesma chamada | 4 | Propria | Ate 3 em falha transitoria | Nao | Nao |

## Regras e excecoes

O dia civil da aplicacao usa exclusivamente `America/Sao_Paulo`.

| Dominio | Elegivel | Corte | Transicao | Excecoes preservadas |
| --- | --- | --- | --- | --- |
| Escala | `PUBLISHED` | `date` anterior ao dia atual | `COMPLETED` | `DRAFT`, `CANCELED`, `COMPLETED`, soft-deleted |
| Evento | `DRAFT` ou `PUBLISHED` | `COALESCE(endDate, startDate)` anterior ao dia atual | `ARCHIVED` | `CANCELED`, `COMPLETED`, `ARCHIVED`, soft-deleted |
| Comunicado | `DRAFT` ou `PUBLISHED` com `expiresAt` | instante anterior ao inicio do dia atual | `ARCHIVED` | sem expiracao, `ARCHIVED`, soft-deleted |

O registro permanece ativo durante todo o seu ultimo dia civil. O uso de data local
e centralizado em `application-time.ts`. Escalas e eventos armazenam datas civis
como meia-noite UTC e recebem o dia local codificado da mesma forma. Comunicados
armazenam instantes e recebem o instante UTC equivalente a meia-noite em Sao Paulo.

## Concorrencia, retry e retomada

Todos os jobs internos compartilham o namespace inteiro `0x00494245` (`IBE`), mas
possuem chaves independentes:

| Processador | Chave |
| --- | ---: |
| Lembretes de escala | 1 |
| Lifecycle de escalas | 2 |
| Lifecycle de eventos | 3 |
| Lifecycle de comunicados | 4 |

Cada lifecycle abre sua propria transacao, adquire `pg_try_advisory_xact_lock`,
seleciona no maximo 100 itens com `FOR UPDATE SKIP LOCKED` e repete os criterios no
`updateMany`. Assim, concorrencia nao amplia a elegibilidade e uma nova invocacao
retoma o lote seguinte. O estado terminal torna a reexecucao idempotente.

Falhas transitorias de transacao (`P2034`, PostgreSQL `40001` ou `40P01`) possuem
ate tres tentativas, sempre abrindo uma transacao nova. Outros erros falham sem
retry. Cada processador registra apenas nome, tentativa, codigo tecnico, contadores
e duracao; nao registra IDs, dados pessoais, payloads de notificacao ou segredos.

## Notificacoes e encerramento manual

O encerramento automatico nao publica notificacoes e nao incrementa
`notificationVersion`. Ao concluir uma escala, apenas lembretes ainda pendentes
sao cancelados na mesma transacao; notificacoes ja entregues sao preservadas.

O encerramento manual usa a mesma transicao terminal. Depois de `COMPLETED`, salvar
observacoes ou participantes permitidos pela regra atual nao reabre a escala e nao
gera notificacoes de alteracao. Cancelamento, exclusao e mudancas de campos
operacionais continuam bloqueados conforme o service.

## Listagens

Escalas, Minhas Escalas, Eventos e Comunicados escondem itens encerrados por
padrao. A opcao `Apresentar todos` envia o filtro tipado para a API. A restricao e
montada no Repository e executada pelo Prisma antes de ordenacao e paginacao; o
frontend nao remove registros depois da consulta.

## Backfill e migrations

As migrations `20260804120000_add_event_archived_status` e
`20260804120100_backfill_expired_lifecycle_statuses`:

1. adicionam `ARCHIVED` a `EventStatus` e o indice de lifecycle;
2. arquivam eventos antigos somente em `DRAFT` ou `PUBLISHED`;
3. arquivam comunicados expirados em `DRAFT` ou `PUBLISHED`;
4. concluem escalas antigas somente em `PUBLISHED`;
5. ignoram soft delete e preservam `createdAt`, `publishedAt`, `updatedById` e
   `notificationVersion`.

Os filtros por estado terminal tornam o SQL idempotente. As migrations devem ser
aplicadas primeiro em um Neon Development isolado e explicitamente confirmado;
esta implementacao nao autoriza aplicacao em Production.

## ADR: status persistido

**Decisao:** persistir `COMPLETED`/`ARCHIVED` em vez de calcular o estado apenas na
leitura.

**Motivos:** o status terminal ja participa das regras de edicao, RBAC operacional,
consultas e auditoria; persistir evita que cada superficie replique logica temporal
e permite indices simples. O cron e idempotente e processa lotes pequenos, reduzindo
o custo operacional.

**Consequencias:** o agendador precisa continuar ativo e o corte temporal deve ser
unico. Se uma execucao falhar, itens podem permanecer visiveis ate a proxima
tentativa, mas nao sao corrompidos. Filtros por data continuam no Repository como
defesa para as listagens padrao durante esse intervalo.

## ADR: orquestrador e cron unico

**Decisao:** manter um `ScheduledJobsService` acionado por um unico cron externo e
delegar cada responsabilidade a um processador independente.

**Motivos:** o plano de hospedagem nao agenda varios crons nativos; um endpoint
autenticado reduz configuracao operacional. O orquestrador concentra a composicao
sem mover regras para a Route. Transacoes separadas evitam que falha ou rollback de
um dominio reverta trabalho valido de outro, e locks distintos permitem concorrencia
segura sem bloqueio cruzado.

**Extensao:** novos jobs, como limpeza de logs, sincronizacoes, e-mails ou tarefas
administrativas, podem ser adicionados com service, transacao, chave de lock, retry
e resultado proprios. Eles nao devem compartilhar transacao com jobs existentes e
devem entrar no `allSettled` para preservar o isolamento de falhas.
