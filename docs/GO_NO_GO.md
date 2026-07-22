# IBE 0.2.0 RC2 - Go / No-Go

Use este documento imediatamente antes da publicacao oficial da versao 0.2.0.

## GO

A publicacao pode prosseguir somente quando todos os itens abaixo forem verdadeiros:

- [ ] Build aprovado.
- [ ] TypeScript aprovado.
- [ ] ESLint aprovado.
- [ ] Prisma validate aprovado.
- [ ] Prisma generate aprovado.
- [ ] Prisma migrate status sem pendencias inesperadas.
- [ ] Seed idempotente validado em ambiente autorizado.
- [ ] Dashboard administrativo funcionando.
- [ ] Portal do Membro funcionando.
- [ ] Uploads funcionando.
- [ ] RBAC validado em paginas e APIs.
- [ ] Banco conectado.
- [ ] Migrations aplicadas corretamente.
- [ ] Push Notifications funcionando em dispositivo de teste.
- [ ] Health check `/api/health/db` retornando connected.
- [ ] Smoke Tests aprovados.
- [ ] Login Admin aprovado.
- [ ] Login Membro aprovado.
- [ ] APIs protegidas bloqueiam acesso anonimo.
- [ ] Nenhuma credencial exposta.
- [ ] Nenhum bug critico ou alto aberto.

## NO GO

Interrompa a publicacao se qualquer item abaixo ocorrer:

- [ ] Build falhou.
- [ ] TypeScript falhou.
- [ ] ESLint falhou.
- [ ] Prisma validate/generate falhou.
- [ ] Migration falhou ou ficou pendente sem justificativa.
- [ ] Seed falhou em ambiente autorizado.
- [ ] Login falhou.
- [ ] Dashboard ou Portal indisponivel.
- [ ] RBAC permite acesso indevido.
- [ ] Uploads retornam erro 500.
- [ ] Push envia para destinatarios incorretos.
- [ ] Health check nao conecta ao banco.
- [ ] API protegida retorna dados sem sessao.
- [ ] Credencial, token ou segredo foi exposto.
- [ ] Erro critico foi identificado durante smoke test.

## Decisao

- Resultado: GO / NO GO
- Responsavel:
- Data/hora:
- Observacoes:
