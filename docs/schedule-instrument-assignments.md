# Instrumentos em participantes de escalas

A integração usa ScheduleMember, a entidade real de participante da escala. O vínculo não fica em Schedule.

Cada ScheduleMemberInstrumentAssignment registra uma etapa da linha do tempo: categoria, origem, instrumento físico opcional, início, fim, motivo e autoria. endedAt nulo identifica o assignment atual. Um índice parcial único no PostgreSQL impede mais de um assignment ativo por participante.

- REGISTERED exige Instrument ativo, não removido e pertencente à categoria ativa informada.
- OWN exige categoria ativa e mantém instrumentId nulo; nenhum patrimônio fictício é criado.
- Somente role INSTRUMENT aceita assignment.
- Ao mudar para outra função, substituir, trocar o membro do registro ou remover o participante, o assignment ativo é encerrado, nunca apagado.
- A substituição atual com status REPLACED e replacedByMemberId não transfere instrumento ao substituto.
- Escalas antigas e instrumentistas sem assignment continuam válidos, sem backfill inferido.
- FKs RESTRICT preservam categoria e instrumento históricos mesmo após inativação, manutenção ou soft delete.
- schedule.update, e não permissões instrument.*, governa a definição inicial.

Esta etapa não inclui troca pelo membro, histórico visual, alteração de notificações, Web Push ou reminders. A tabela de assignments será a fonte do histórico futuro.