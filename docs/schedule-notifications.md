# Notificacoes internas de escalas

## Regra de publicacao

Escalas nascem em `DRAFT` e nao geram notificacoes. A primeira transicao
`DRAFT -> PUBLISHED` define `publishedAt`, incrementa `notificationVersion` e
notifica os participantes elegiveis. Repetir a publicacao de uma escala ja
publicada e idempotente.

O `PUT /api/schedules/[id]` nao aceita `status`. Publicacao, cancelamento e
conclusao permanecem nas acoes protegidas por suas permissoes especificas.
Despublicacao nao e suportada.

```text
DRAFT -> PUBLISHED -> COMPLETED
   \          \
    \          -> CANCELED
     -> CANCELED
```

As mutacoes administrativas bloqueiam a linha da escala com `SELECT ... FOR
UPDATE`. A publicacao ainda usa uma atualizacao condicional com origem
`DRAFT`. Assim, duas requisicoes concorrentes sao serializadas e somente a
primeira pode mudar o status, incrementar a versao e criar notificacoes.

## Destinatarios e preferencias

O vinculo `ScheduleMember -> Member -> User` determina o destinatario. Membros
sem usuario e usuarios inativos sao ignorados sem impedir a operacao principal.
`SCHEDULE_PUBLISHED` representa as notificacoes operacionais de escala e
`SCHEDULE_REMINDER` representa o lembrete. Defaults e preferencias persistidas
sao resolvidos pela infraestrutura central, sem criar preferencias implicitas.

## Alteracoes relevantes

Geram uma nova `notificationVersion`, uma notificacao consolidada e o
reagendamento dos lembretes:

- titulo e descricao;
- data, horario inicial e horario final;
- local;
- ministerio;
- observacoes visiveis na escala;
- inclusao, remocao e substituicao de participante;
- funcao, status e observacoes visiveis do participante;
- cancelamento e conclusao de uma escala que ja foi publicada.

Nao geram notificacao: `eventId`, timestamps de auditoria, autor da criacao ou
alteracao e qualquer persistencia sem mudanca efetiva. O `eventId` continua
sendo salvo normalmente; ele apenas nao altera a comunicacao exibida ao membro.

## Consistencia e deduplicacao

Mutacao e notificacoes sao gravadas na mesma transacao Prisma. Uma falha causa
rollback da operacao inteira. As chaves usam `notificationVersion`, o ID da
escala e o participante/usuario, distinguindo uma nova alteracao de um retry.
Notificacoes ja entregues sao preservadas; somente lembretes pendentes sao
cancelados quando a participacao ou a escala deixa de ser elegivel.

```text
ScheduleService
  -> NotificationPublisher
    -> NotificationService
      -> NotificationRepository
        -> Notification
```

`notificationVersion` inicia em `0`, passa para `1` na primeira publicacao e
somente avanca em uma mutacao notificavel de uma escala publicada. Antes de
criar os lembretes da nova versao, todos os lembretes pendentes anteriores da
escala ou do participante afetado sao cancelados. A restricao unica
`(userId, deduplicationKey)` e `createMany(..., skipDuplicates: true)` tornam
retries idempotentes.

## Lembretes

Cada participante elegivel recebe um registro agendado conforme
`reminderHoursBefore` (24 horas por padrao). Se a publicacao ocorrer dentro da
janela, a notificacao de inclusao e suficiente e nenhum lembrete imediato
duplicado e criado.

`scheduleNotificationService.processPendingReminders()` e o contrato
idempotente do processador. Ele revalida escala publicada, participante e
usuario antes de marcar o lembrete como enviado. Nenhum cron, timer, polling ou
worker residente foi ativado nesta Story. Uma futura Vercel Cron podera chamar
esse contrato por uma rota autenticada dedicada.

A elegibilidade do lote e consultada de uma vez, incluindo participantes
originais e substitutos, sem uma consulta por notificacao. Processamentos
concorrentes usam updates condicionais em registros ainda nao enviados; apenas
um processador consegue marcar cada lembrete como entregue.
