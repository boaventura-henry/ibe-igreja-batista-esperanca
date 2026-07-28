# Rollout expand/contract de Notification

## Escopo desta fase

Esta fase e somente `expand`. Ela adiciona a nova infraestrutura sem remover ou
reinterpretar destrutivamente o contrato antigo.

Permanecem no banco:

- `deletedAt`;
- `actionUrl`;
- todos os valores legados de `entityType`;
- os quatro indices baseados em `deletedAt`.

A fase `contract` nao faz parte desta Story.

## Ordem segura de rollout

1. Confirmar que `DATABASE_URL` e `DIRECT_URL` apontam exclusivamente para o
   ambiente desejado e usam conexao direta para DDL.
2. Aplicar as migrations expand e de backfill.
3. Aplicar, uma por vez, as migrations de indices concorrentes.
4. Verificar schema, backfill, constraints, indices validos e logs do Prisma.
5. Implantar a aplicacao nova.
6. Manter temporariamente instancias antigas e novas em convivencia.
7. Observar leitura, ocultacao, cancelamento e navegacao antes de considerar a
   futura fase contract.

A aplicacao antiga continua usando `deletedAt`. A aplicacao nova le `deletedAt` e
os campos novos e faz dual-write ao ocultar ou cancelar. Por isso o schema expandido
pode ser aplicado antes da aplicacao nova sem interromper instancias antigas.

## Migrations e atomicidade

### 20260728120000_expand_notification_lifecycle

Operacoes atomicas entre `BEGIN` e `COMMIT`:

- adiciona `hiddenAt`, `cancelledAt`, `expiresAt` e `createdById` como nullable;
- adiciona a FK de `createdById` como `NOT VALID`;
- nao altera linhas existentes;
- nao remove coluna, URL, indice ou valor legado.

A FK `NOT VALID` passa a ser exigida para novos valores, mas evita uma varredura de
validacao nesta fase. Como `createdById` nasce nulo, registros antigos continuam
atualizaveis.

### 20260728120100_backfill_notification_lifecycle

Operacoes atomicas entre `BEGIN` e `COMMIT`:

- copia `deletedAt` para `hiddenAt` apenas quando `sentAt IS NOT NULL` e
  `hiddenAt IS NULL`;
- copia `deletedAt` para `cancelledAt` apenas quando `sentAt IS NULL` e
  `cancelledAt IS NULL`.

Valores novos ja preenchidos sempre vencem. `deletedAt`, `actionUrl` e `entityType`
nao sao alterados.

### Migrations 20260728120200 a 20260728120500

Cada pasta contem exatamente um `CREATE INDEX CONCURRENTLY` e nenhuma transacao
explicita. Isso evita misturar `CONCURRENTLY` com `BEGIN/COMMIT` e torna a
recuperacao de cada indice independente.

Os indices antigos permanecem disponiveis durante toda a construcao dos novos.

## Locks e timeouts

As migrations transacionais usam:

```sql
SET LOCAL lock_timeout = '5s';
```

Cinco segundos sao suficientes para locks de catalogo normalmente breves e evitam
que um deploy bloqueado forme uma fila indefinida de requisicoes.

A fase de schema usa:

```sql
SET LOCAL statement_timeout = '2min';
```

A fase de backfill usa:

```sql
SET LOCAL statement_timeout = '15min';
```

O limite maior do backfill permite trabalho de dados controlado sem aceitar uma
transacao indefinida.

As migrations concorrentes possuem apenas o comando de indice. Timeouts dessas
sessoes devem ser configurados na conexao direta usada pelo deploy, por exemplo
com parametros PostgreSQL `options=-c lock_timeout=5s -c statement_timeout=30min`.
Adicionar `SET` ao mesmo arquivo poderia mudar a forma como ferramentas executam o
script e colocar `CREATE INDEX CONCURRENTLY` em contexto transacional.

`CREATE INDEX CONCURRENTLY` nao bloqueia inserts, updates ou deletes como um indice
convencional, mas pode aguardar transacoes antigas e consome CPU, I/O e duas
varreduras da tabela. Deve ser executado fora do horario de pico.

## Custo estimado

- Expand: alteracao de catalogo, sem default e sem reescrita de linhas; exige lock
  forte, esperado por periodo curto.
- FK `NOT VALID`: sem varredura integral de `Notification`; adquire locks de DDL
  sobre `Notification` e `User`.
- Backfill: duas varreduras de `Notification`, pois nao existe indice liderado por
  `deletedAt`; somente linhas ainda nao migradas sao reescritas.
- Backfill: gera WAL e versoes MVCC apenas para notificacoes com `deletedAt` e campo
  de destino nulo; autovacuum recuperara o espaco posteriormente.
- Indices: quatro construcoes concorrentes independentes, normalmente duas
  varreduras por indice e espaco adicional em disco.
- Indice de `createdById`: adiado. Todos os valores nascem nulos e nenhuma Story
  atual produz ator; ele deve ser criado concorrentemente antes de uso relevante
  ou caso operacoes sobre `User` demonstrem necessidade.

Para volume que nao caiba no `statement_timeout` de 15 minutos, nao aumentar o
limite cegamente. O backfill deve ser removido da migration antes de qualquer
aplicacao e executado por ferramenta operacional em lotes deterministas, com
commit entre lotes, observabilidade e os mesmos predicados `IS NULL`.

## Entity type legado

Valores canonicos definidos pela aplicacao:

- `SCHEDULE`;
- `NOTICE`;
- `EVENT`;
- `MEMBER`;
- `CONTRIBUTION`;
- `MINISTRY`;
- `USER`.

Esta fase nao normaliza nem restringe `entityType`. Assim, valores desconhecidos e
referencias incompletas continuam legiveis e atualizaveis. `actionUrl` permanece
como fallback seguro quando o catalogo nao consegue resolver a referencia.

Antes da fase contract, executar a auditoria:

```sql
SELECT "entityType", COUNT(*)
FROM "Notification"
GROUP BY "entityType"
ORDER BY COUNT(*) DESC;

SELECT COUNT(*) AS incomplete_references
FROM "Notification"
WHERE ("entityType" IS NULL) <> ("entityId" IS NULL);

SELECT "entityType", COUNT(*)
FROM "Notification"
WHERE "entityType" IS NOT NULL
  AND "entityType" NOT IN (
    'SCHEDULE', 'NOTICE', 'EVENT', 'MEMBER',
    'CONTRIBUTION', 'MINISTRY', 'USER'
  )
GROUP BY "entityType";
```

Nenhuma check constraint de `entityType` e adicionada antes dessa auditoria. A
constraint futura somente podera ser criada depois da correcao dos dados e devera
ser validada em operacao separada.

## Verificacoes apos o backfill

```sql
SELECT COUNT(*) AS missing_hidden
FROM "Notification"
WHERE "deletedAt" IS NOT NULL
  AND "sentAt" IS NOT NULL
  AND "hiddenAt" IS NULL;

SELECT COUNT(*) AS missing_cancelled
FROM "Notification"
WHERE "deletedAt" IS NOT NULL
  AND "sentAt" IS NULL
  AND "cancelledAt" IS NULL;

SELECT COUNT(*) AS preserved_action_urls
FROM "Notification"
WHERE "actionUrl" IS NOT NULL;
```

Os dois primeiros resultados devem ser zero. O terceiro e informativo e nao deve
ser forcado a zero.

Verificar indices concorrentes:

```sql
SELECT indexrelid::regclass AS index_name, indisvalid, indisready
FROM pg_index
WHERE indexrelid::regclass::text LIKE '"Notification_%"';
```

Todos os novos indices devem apresentar `indisvalid = true` e `indisready = true`.

## Recuperacao apos falha

### Expand ou backfill

Como essas migrations possuem transacao explicita, uma falha reverte todas as
operacoes daquela pasta. Depois de corrigir a causa:

1. confirmar o rollback no schema e nos dados;
2. marcar a migration falha como rolled back com `prisma migrate resolve
   --rolled-back <migration>`;
3. executar novamente o deploy de migrations.

Nunca marcar como aplicada sem verificar o estado real.

### Indice concorrente

Uma falha pode deixar um indice invalido. Para a migration correspondente:

1. consultar `pg_index.indisvalid` e `pg_index.indisready`;
2. se existir indice invalido, remove-lo com `DROP INDEX CONCURRENTLY`;
3. confirmar que o indice antigo continua valido;
4. marcar somente aquela migration como rolled back;
5. repetir a aplicacao.

Nao repetir cegamente `CREATE INDEX CONCURRENTLY`, porque um indice invalido com o
mesmo nome impedira a nova criacao.

## Futura fase contract

Uma migration futura podera considerar:

- validar a FK de `createdById`;
- corrigir e validar o contrato de `entityType`;
- deixar de fazer dual-write em `deletedAt`;
- deixar de usar `actionUrl` como fallback;
- remover `deletedAt` e os quatro indices antigos;
- limpar URLs e dados comprovadamente obsoletos;
- criar o indice de `createdById` se houver uso e justificativa.

A fase contract somente pode ocorrer depois de:

- todas as instancias executarem a versao nova;
- periodo de estabilidade concluido;
- backfill verificado com zero pendencias;
- indices novos validos;
- resolvedor de destinos observado em producao;
- valores legados e referencias incompletas auditados;
- backup e plano de rollback aprovados.
