# Historico de utilizacao das musicas

O historico administrativo e derivado das relacoes existentes:

`Song -> ScheduleSong -> Schedule`

Nao existe uma tabela de historico duplicada. Um uso existe enquanto o
`ScheduleSong` e a respectiva `Schedule` nao estiverem removidos por soft
delete.

## Criterios

- Escalas em rascunho, publicadas, concluidas e canceladas sao consideradas.
- O status da escala e exibido e pode ser filtrado.
- Escalas removidas e vinculos removidos do repertorio nao sao considerados.
- O resumo usa a data da escala, e nao a data de criacao do vinculo.
- O Evento e uma relacao opcional da Escala. Escalas anteriores permanecem sem
  evento ate que esse relacionamento seja informado.

## Autorizacao

O endpoint administrativo exige `song.view` por meio de
`requireScheduleAccess()`.

- `ScheduleScope.ALL`: permite consultar todos os usos.
- `ScheduleScope.MEMBER_MINISTRIES`: limita os usos aos ministerios ativos do
  operador.
- Usuario restrito sem membro ou sem ministerios ativos recebe historico vazio.

O Portal e Minhas Escalas nao foram alterados.

## API

`GET /api/songs/[id]/usage-history`

Filtros: titulo da escala, periodo, Ministerio, Evento, status, ordem, pagina e
tamanho da pagina. O tamanho e limitado a 50 registros. A resposta inclui o
resumo, os registros paginados e opcoes de filtro autorizadas.

## Performance

Filtros, ordenacao e paginacao sao executados no PostgreSQL. O resumo do
catalogo utiliza agregacao SQL por musica. Os indices
`ScheduleSong(songId, deletedAt)` e `Schedule(eventId)` atendem os novos acessos.

O catalogo administrativo exibe quantidade e ultima utilizacao. A integracao
desse resumo no autocomplete do repertorio ficou como melhoria futura para nao
ampliar o fluxo de montagem nesta Epic.
