# IBE 0.2.0 RC2 - Deploy Runbook

Este runbook orienta a publicacao operacional da versao 0.2.0 do IBE. Ele nao substitui a revisao tecnica: use-o como roteiro de execucao e evidencia.

## Pre Deploy

- [ ] Backup do banco confirmado.
- [ ] Banco correto confirmado.
- [ ] Ambiente correto confirmado.
- [ ] Branch/tag correta confirmada.
- [ ] Variaveis de ambiente conferidas sem expor valores.
- [ ] `DATABASE_URL` configurada.
- [ ] `DIRECT_URL` configurada.
- [ ] `NEXTAUTH_SECRET` configurada.
- [ ] `NEXTAUTH_URL` configurada para a URL oficial.
- [ ] `BLOB_READ_WRITE_TOKEN` configurada quando uploads forem exigidos.
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` configurada.
- [ ] `VAPID_PRIVATE_KEY` configurada.
- [ ] `VAPID_SUBJECT` configurada.
- [ ] Build local aprovado.
- [ ] TypeScript aprovado.
- [ ] ESLint aprovado.
- [ ] Prisma validate/generate aprovado.
- [ ] RC2 aprovado.
- [ ] Janela de deploy comunicada.

## Execucao

- [ ] Confirmar estado do Git: `git status`.
- [ ] Confirmar commit/tag alvo.
- [ ] Executar `npx prisma migrate deploy`.
- [ ] Executar `npx prisma generate`.
- [ ] Executar seed idempotente somente quando autorizado: `npm run prisma:seed`.
- [ ] Realizar deploy na Vercel pela branch/tag oficial.
- [ ] Aguardar status READY na Vercel.
- [ ] Confirmar que o alias oficial aponta para o deploy correto.

## Validacao

- [ ] Login Admin.
- [ ] Login Membro.
- [ ] Logout.
- [ ] Dashboard administrativo.
- [ ] Portal do Membro.
- [ ] Widgets configuraveis por perfil.
- [ ] Upload de foto de membro.
- [ ] Upload de imagem de ministerio/evento.
- [ ] Push Notifications.
- [ ] Historico de notificacoes.
- [ ] Saude das notificacoes.
- [ ] Tela Sobre.
- [ ] Roadmap.
- [ ] Release Notes.
- [ ] Diagnostico do schema.
- [ ] `/api/health/db`.
- [ ] APIs administrativas protegidas.
- [ ] Middleware de rotas protegidas.
- [ ] Sessoes NextAuth.
- [ ] RBAC em menus e APIs.

## Finalizacao

- [ ] Atualizar `app-releases`.
- [ ] Marcar versao `0.2.0` como `PUBLISHED`.
- [ ] Inserir data real de publicacao.
- [ ] Atualizar `CHANGELOG.md`.
- [ ] Executar Smoke Test Final.
- [ ] Registrar resultado Go/No-Go.
- [ ] Encerrar deploy.

## Evidencias Recomendadas

- Hash publicado.
- URL final.
- Status do deploy.
- Resultado de migrations.
- Resultado do smoke test.
- Responsavel pela validacao.
- Data/hora da conclusao.
