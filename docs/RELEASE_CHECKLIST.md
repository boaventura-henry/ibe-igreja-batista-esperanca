# IBE 0.2.0 RC2 - Release Checklist

## Arquitetura

- [ ] App Router preservado.
- [ ] Repository -> Service -> API -> Component preservado.
- [ ] Componentes React nao acessam Prisma diretamente.
- [ ] Validadores centralizados.
- [ ] Tipos compartilhados centralizados.

## Seguranca

- [ ] RBAC revisado.
- [ ] Sem bypass por role fixa.
- [ ] APIs protegidas usam sessao/permissao.
- [ ] `passwordHash` nao retorna ao frontend.
- [ ] Variaveis sensiveis nao versionadas.
- [ ] VAPID privada nao exposta.

## Performance

- [ ] Listagens paginadas.
- [ ] Consultas criticas sem N+1 relevante.
- [ ] Includes/selects revisados.
- [ ] Dashboards sem consultas excessivas por render.

## Banco

- [ ] Prisma validate aprovado.
- [ ] Prisma generate aprovado.
- [ ] Migrations revisadas.
- [ ] `migrate status` sem pendencias inesperadas.
- [ ] Backup confirmado antes do deploy.

## Deploy

- [ ] Branch/tag correta.
- [ ] Vercel conectada ao projeto correto.
- [ ] Production Branch correta.
- [ ] Variaveis conferidas sem exibir valores.
- [ ] Alias oficial confirmado.

## Build

- [ ] `npm run build` aprovado.
- [ ] `npm run lint` aprovado.
- [ ] `npx tsc --noEmit` aprovado.
- [ ] `git diff --check` aprovado.

## Dashboard

- [ ] Layout por perfil.
- [ ] Widgets configuraveis.
- [ ] Permissoes por widget.
- [ ] Indicadores principais.

## Portal

- [ ] Login membro.
- [ ] Meu usuario.
- [ ] Meu cadastro.
- [ ] Minhas escalas.
- [ ] Avisos.

## Push

- [ ] Registro de dispositivo.
- [ ] Envio de teste.
- [ ] Auditoria.
- [ ] Historico.
- [ ] Saude das notificacoes.
- [ ] Sem envio em massa.

## Uploads

- [ ] Vercel Blob configurado.
- [ ] Validacao de tipo.
- [ ] Validacao de tamanho.
- [ ] Preview funcionando.

## Roadmap, Sobre e Versionamento

- [ ] Versao SemVer.
- [ ] Tela Sobre.
- [ ] Roadmap.
- [ ] Release Notes.
- [ ] CHANGELOG preparado.

## Release

- [ ] Go/No-Go aprovado.
- [ ] Runbook executado.
- [ ] Smoke Test final aprovado.
- [ ] `app-releases` atualizado apenas na publicacao oficial.
- [ ] Versao `0.2.0` marcada como `PUBLISHED`.
