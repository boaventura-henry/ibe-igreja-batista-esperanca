# Cron de lembretes de escalas

## Objetivo

Executar periodicamente os lembretes internos de escalas que ja foram criados pelo
lifecycle de notificacoes. O Cron nao cria reminders, nao cria novas regras de
antecedencia e nao envia e-mail ou Web Push.

## Fluxo

```text
Vercel Cron
  -> GET /api/internal/cron/schedule-reminders
  -> ScheduleNotificationService
  -> NotificationRepository / ScheduleRepository
  -> PostgreSQL
```

## Endpoint e autenticacao

- Metodo: `GET`
- Endpoint: `/api/internal/cron/schedule-reminders`
- Runtime: Node.js
- Cache: `no-store`
- Duracao maxima configurada: 60 segundos
- Autenticacao: `Authorization: Bearer <CRON_SECRET>`

O Vercel Cron realiza requisicoes `GET` e, quando `CRON_SECRET` esta configurado
no projeto, envia automaticamente esse segredo no header `Authorization`.

`CRON_SECRET` deve ser exclusivo para o Cron, aleatorio e possuir pelo menos
16 caracteres. Nao reutilize `NEXTAUTH_SECRET`, `DATABASE_URL` ou outro segredo.
Sem `CRON_SECRET`, a rota retorna `503` e nao acessa o banco. Header ausente,
malformado ou incorreto retorna `401`.

## Frequencia

O `vercel.json` agenda a execucao a cada 15 minutos:

```text
*/15 * * * *
```

Essa frequencia equilibra a antecedencia padrao de 24 horas, custo e precisao.
Ela requer um plano Vercel que aceite execucoes mais frequentes que uma vez ao
dia. No plano Hobby, o deployment rejeita esse agendamento.

## Lote e consultas

- Tamanho padrao: 100 reminders por execucao.
- Ordem: `scheduledFor`, `createdAt` e `id`, todos ascendentes.
- Uma invocacao processa no maximo um lote; a seguinte continua o restante.
- A selecao e feita com uma query e `FOR UPDATE SKIP LOCKED`.
- Usuarios ativos, preferencias e vinculos elegiveis sao carregados em tres
  consultas em lote.
- Nao existe consulta por reminder, evitando N+1.
- Reminder invalido ou obsoleto e cancelado; reminder valido recebe `sentAt`.

## Lock distribuido

O job usa `pg_try_advisory_xact_lock(namespace, jobKey)` com identificadores
nomeados e estaveis:

```text
namespace = 0x00494245  // "IBE"
jobKey = 1             // schedule reminders
```

Jobs internos futuros devem reutilizar o namespace e receber outra `jobKey`.
Nao e usado hash dinamico, portanto a coordenada do lock nao muda entre builds.

O lock e transacional:

- e adquirido dentro da mesma transacao que seleciona e atualiza o lote;
- e liberado automaticamente em commit;
- e liberado automaticamente em rollback ou excecao;
- uma nova tentativa abre outra transacao e readquire o lock;
- o encerramento da conexao serverless tambem encerra a transacao no PostgreSQL.

Se o lock estiver ocupado, o endpoint retorna `200`, `executed: false`,
`reason: "already_running"` e contadores zerados. Nenhuma selecao de lote ocorre.

## Camadas de concorrencia e idempotencia

As protecoes sao complementares:

1. Advisory lock global: serializa este job entre instancias serverless.
2. `FOR UPDATE SKIP LOCKED`: impede espera e duplicacao se outra rotina bloquear
   linhas compativeis.
3. Isolamento `Serializable`: detecta conflitos transacionais residuais.
4. Updates condicionais: somente linhas ainda pendentes podem receber `sentAt`
   ou cancelamento.
5. Chave de deduplicacao e `notificationVersion`: impedem reaproveitar reminder
   obsoleto e preservam a idempotencia criada pelo lifecycle da escala.

Nao existe mutex, singleton, fila ou timer em memoria.

## Elegibilidade e classificacao de falhas

Antes da atualizacao, a transacao revalida em lote:

- usuario ativo;
- preferencia habilitada;
- escala publicada e nao removida;
- participante ainda vinculado;
- expiracao;
- `notificationVersion`;
- soft delete e cancelamento.

Falhas esperadas de elegibilidade, chave malformada ou versao obsoleta sao
classificadas por item e canceladas. Um reminder assim nao bloqueia os demais
itens validos do lote.

Falhas estruturais de banco ou codigo nao sao convertidas em cancelamento. Toda
a transacao sofre rollback, sem sucesso parcial persistido. Um erro estrutural
persistente pode voltar na proxima execucao e exige diagnostico operacional; nao
ha dead-letter queue nesta fase.

## Retry transacional

O processador executa no maximo tres tentativas, sempre em transacoes novas.
Retry ocorre somente para codigos tecnicos reconhecidos:

- `P2034`: conflito de write/serializacao informado pelo Prisma;
- `40001`: serialization failure do PostgreSQL;
- `40P01`: deadlock detectado pelo PostgreSQL.

Nao ha retry por texto de mensagem. Erros estruturais, validacao, constraint,
timeout generico (`P2028`) ou codigo desconhecido falham imediatamente. Nao ha
delay ou timer residente entre tentativas. Ao esgotar a terceira tentativa, o
erro e propagado e o lote permanece pendente.

O Vercel Cron nao faz retry automatico da invocacao. Quando o retry transacional
nao resolve, a proxima execucao agendada retoma o lote.

## Contrato HTTP

### 200 processado

```json
{
  "success": true,
  "executionId": "uuid",
  "executed": true,
  "reason": "processed",
  "found": 10,
  "sent": 8,
  "cancelled": 2,
  "skipped": 0,
  "lockAcquired": true,
  "attempts": 1,
  "timings": {
    "lockMs": 0,
    "selectionMs": 0,
    "validationMs": 0,
    "updateMs": 0,
    "transactionMs": 0,
    "totalServiceMs": 0
  }
}
```

Lote vazio usa `executed: true` e `reason: "empty_batch"`. Lock ocupado usa
`executed: false` e `reason: "already_running"`.

### Outros status

- `401`: header ausente, esquema diferente de Bearer ou segredo incorreto.
- `503`: `CRON_SECRET` ausente ou vazio; o banco nao e acessado.
- `500`: falha estrutural inesperada; resposta generica e rollback integral.

## Observabilidade

Os logs registram:

- identificador da execucao;
- inicio e conclusao;
- `executed` e `reason`;
- selecionados, enviados, cancelados e ignorados;
- aquisicao do lock;
- numero de tentativas;
- tempos de autenticacao, lock, selecao, validacao, update, transacao, service
  e requisicao;
- nome do erro ou codigo transacional, sem mensagem ou stack.

Nao sao registrados segredo, Authorization, nome, e-mail, telefone, mensagem da
notificacao ou conteudo do reminder.

## Gate de performance

O teste permanente mede o pipeline em memoria, sem rede ou PostgreSQL. Em
2026-07-30, no Node 24.14.0, uma execucao controlada obteve:

| Cenario | Tempo total aproximado |
| --- | ---: |
| lote vazio | 0,16 ms |
| 1 elegivel | 0,17 ms |
| 10 elegiveis | 0,25 ms |
| 50 elegiveis | 0,15 ms |
| 100 elegiveis | 0,41 ms |
| 100 mistos | 0,91 ms |
| 100 obsoletos | 0,28 ms |
| duas execucoes concorrentes com espera simulada | 35,11 ms |
| falha final com rollback | 0,33 ms |

Esses numeros validam complexidade e ausencia de N+1 no codigo, nao latencia de
rede ou do banco. O teste concorrente real e o plano de execucao SQL devem ser
repetidos em um Neon Development confirmado antes da publicacao. Production nao
foi acessada neste Gate.

## Teste manual autorizado

Use uma variavel local e nunca escreva o segredo no comando ou em arquivo
versionado:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Get `
  -Uri "https://SEU_DOMINIO/api/internal/cron/schedule-reminders" `
  -Headers $headers
```

## Desativacao segura

Para suspender temporariamente, use `Disable Cron Jobs` nas configuracoes do
projeto Vercel. Para remover permanentemente, retire a entrada de `crons` do
`vercel.json` e publique uma nova versao. Remover `CRON_SECRET` faz a rota falhar
fechada com `503`, mas nao substitui a desativacao do agendamento.

## Riscos conhecidos

- Precisao e limites do Cron dependem do plano Vercel.
- Lote de 100 pressupoe volume moderado e deve ser monitorado.
- Falha estrutural persistente repete na proxima janela ate ser diagnosticada.
- Nao ha dead-letter queue ou contador persistido de tentativas nesta fase.
- O teste permanente de concorrencia e deterministico; a validacao PostgreSQL
  real permanece pendente em ambiente Development autorizado.
