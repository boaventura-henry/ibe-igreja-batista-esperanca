# IBE 0.2.16 - Production Deploy Runbook

Este runbook orienta a publicacao operacional da versao 0.2.16 do IBE. Ele nao substitui a revisao tecnica: use-o como roteiro de execucao e evidencia. Cada etapa abaixo depende da anterior. Se qualquer etapa falhar, **STOP**: nao prossiga automaticamente para deploy, publicacao, tag ou release.

## Sequencia obrigatoria

1. Pre-publication blockers resolvidos.
2. Confirmar targets Production (`DATABASE_URL` e `DIRECT_URL`).
3. Backup e change control confirmados.
4. Migration.
5. Migration status.
6. Permission sync.
7. Permission/grant verification somente leitura.
8. Deploy.
9. Smoke Test Final.
10. Marcar `PUBLISHED`.
11. Tag / release.

Nao ha seed na sequencia de publicacao 0.2.16. O seed **nao e necessario para a release 0.2.16** e nao deve ser executado como substituto de migration, permission sync ou permission verification.

## 1. Pre-publication blockers

- [ ] Confirmar que todos os blockers de publicacao foram resolvidos antes de iniciar o rollout.
- [ ] Confirmar aprovacao oficial/juridica do aviso de privacidade de visitantes. A publicacao permanece bloqueada enquanto `visitorPrivacyNotice` estiver `DRAFT`, o texto estiver `null`, ou a aprovacao oficial/juridica estiver ausente.
- [ ] Confirmar branch, commit e tag alvo.
- [ ] Confirmar estado do Git: `git status`.
- [ ] Confirmar janela de deploy e change control.
- [ ] Build local, TypeScript, ESLint e Prisma validate/generate aprovados.

## 2. Confirmar targets Production antes de qualquer escrita

- [ ] Confirmar inequivocamente que `DATABASE_URL` aponta para o ambiente Production esperado antes de migration, permission sync, seed ou outra escrita.
- [ ] Confirmar inequivocamente que `DIRECT_URL` aponta para o mesmo ambiente Production esperado antes de migration, permission sync, seed ou outra escrita.
- [ ] Registrar apenas metadados seguros para a confirmacao, como ambiente, host autorizado e nome/identificador do banco. Nunca imprimir password, token, secret ou connection string completa.
- [ ] Confirmar as variaveis de ambiente sem expor valores: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` e as demais exigidas pelo deploy.

O schema Prisma configura `DATABASE_URL` como datasource da aplicacao e `DIRECT_URL` como conexao direta. Ambas devem ser confirmadas como Production antes de qualquer operacao que possa escrever no banco. Se qualquer uma nao puder ser confirmada inequivocamente, **STOP**: nao executar migration, permission sync, seed ou publicacao.

## 3. Backup e change control

- [ ] Confirmar backup recuperavel do banco Production correto.
- [ ] Confirmar plano de rollback/contencao e responsavel pelo change control.
- [ ] Confirmar ambiente e banco corretos apos a verificacao dos dois targets.

## 4. Migration controlada

- [ ] Executar `npx prisma migrate deploy`.
- [ ] Executar `npx prisma migrate status` e confirmar o status da migration de Production.

Se migration ou migration status falhar, **STOP**. Nao executar permission sync e nao realizar deploy.

## 5. Permission sync e verificacao

- [ ] Executar `npm run prisma:sync-permissions` de forma controlada e fora do build da Vercel. O comando idempotente sincroniza o catalogo e os grants do perfil `Administrador` usando a configuracao Prisma do ambiente confirmado.
- [ ] Executar imediatamente `npm run prisma:verify-visitor-permissions`. Esta verificacao e somente leitura e exige `visitor.view`, `visitor.create`, `visitor.update` e `visitor.delete`, incluindo os grants esperados do perfil `Administrador`.

Sucesso de migration nao implica sucesso de permission sync. Se permission sync ou permission/grant verification falhar, **STOP**. Nao realizar deploy, nao marcar `PUBLISHED` e nao criar tag ou release ate a falha ser resolvida e a verificacao passar.

## 6. Deploy

O deploy so pode iniciar depois de migration, migration status, permission sync e permission/grant verification terem passado. Seed nao e necessario para a release 0.2.16 e nao faz parte deste rollout.

- [ ] Realizar deploy na Vercel pela branch/tag oficial.
- [ ] Aguardar status READY na Vercel.
- [ ] Confirmar que o alias oficial aponta para o deploy correto.

Se o deploy falhar, **STOP**. Acionar o plano de contencao/rollback aprovado no change control; nao marcar `PUBLISHED` e nao criar tag ou release.

## 7. Smoke Test Final

Executar o Smoke Test Final somente depois de deploy concluido e alias confirmado.

- [ ] Aplicacao disponivel na URL oficial.
- [ ] `/visite-nos` disponivel.
- [ ] Turnstile real/configuracao Production operacional.
- [ ] Privacy gating de visitantes operacional.
- [ ] Public visitor check-in operacional.
- [ ] Autenticacao administrativa operacional.
- [ ] `/visitantes` disponivel.
- [ ] RBAC Visitor: leitura e edicao conforme permissoes.
- [ ] Historico de visitantes conforme o escopo 0.2.16.
- [ ] APIs administrativas protegidas, middleware, sessoes NextAuth e `/api/health/db` verificados.

Se o smoke test falhar, **STOP**. Acionar o plano de contencao/rollback aprovado; nao marcar `PUBLISHED` e nao criar tag ou release.

## 8. Marcar PUBLISHED

Somente apos o Smoke Test Final PASS:

- [ ] Atualizar `app-releases`.
- [ ] Marcar versao `0.2.16` como `PUBLISHED`.
- [ ] Inserir data real de publicacao.
- [ ] Atualizar `CHANGELOG.md`.
- [ ] Registrar resultado Go/No-Go.

Se a marcacao `PUBLISHED` falhar, **STOP**. Nao criar tag ou release.

## 9. Tag / release

Somente depois de deploy concluido, Smoke Test Final PASS e estado `PUBLISHED` confirmado:

- [ ] Criar a tag/release conforme o processo aprovado.
- [ ] Registrar hash publicado, URL final, resultados de migration, permission verification e smoke test.
- [ ] Encerrar deploy.

Se tag ou release falhar, **STOP** e registrar a falha no change control. Nao executar automaticamente novas operacoes de banco ou novo deploy.

## Evidencias recomendadas

- Hash publicado e tag/release.
- Identificadores seguros usados para confirmar `DATABASE_URL` e `DIRECT_URL` Production.
- Status de migration.
- Resultado do permission sync e da permission/grant verification somente leitura.
- Status do deploy e URL final.
- Resultado do Smoke Test Final.
- Responsavel pela validacao e data/hora da conclusao.
