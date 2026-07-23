# Release Notes - IBE 0.2.0

Status: publicado em 23/07/2026.

## Resumo

A versao 0.2.0 consolida a base operacional do IBE como uma aplicacao administrativa e portal do membro com arquitetura madura, seguranca por permissoes, dashboards configuraveis, versionamento interno e observabilidade inicial.

## Principais Melhorias

- Dashboard administrativo modular.
- Widgets configuraveis por perfil.
- Layout respeitando permissoes.
- Portal do Membro estabilizado.
- Push Notifications com auditoria, historico e painel de saude.
- Versionamento SemVer da aplicacao.
- Tela Sobre com historico, roadmap e informacoes de release.
- Diagnostico administrativo do schema.
- Hardening da RC1.

## Dashboard

O Dashboard passa a suportar composicao por widgets e exibicao orientada por perfil de acesso. Isso reduz ruido visual e prepara a aplicacao para novas metricas sem quebrar a arquitetura existente.

## RBAC

As permissoes continuam centralizadas e aplicadas em menus, middleware, APIs e componentes. A versao reforca a dependencia de `permissionCodes` em vez de regras fixas por papel.

## Roadmap

O roadmap do sistema fica documentado dentro da aplicacao, permitindo acompanhar itens planejados, em andamento e concluidos sem expor informacoes sensiveis.

## Versionamento

A aplicacao passa a operar com versao SemVer centralizada. As release notes e o historico permitem comunicar mudancas de forma controlada aos usuarios.

## Seguranca

- Sessoes e rotas continuam protegidas por NextAuth.
- APIs sensiveis exigem permissao.
- Diagnosticos tecnicos nao expoem strings de conexao, segredos ou checksums sensiveis.
- Push Notifications nao expem chaves privadas nem endpoints reais nas telas administrativas.

## Uploads

Os uploads permanecem integrados ao Vercel Blob, com validacao de tipo e tamanho e uso de variaveis de ambiente.

## Performance

Listagens e dashboards mantem paginacao, consultas direcionadas e carregamento controlado. O painel de Push limita resultados e usa visao agregada para operacao.

## Arquitetura

A arquitetura Repository -> Service -> API -> Component foi preservada. A sprint RC2 nao altera regras de negocio e prepara a operacao de deploy com runbook, rollback, smoke tests e checklist.

## Compatibilidade

- Next.js App Router.
- TypeScript.
- Prisma ORM.
- PostgreSQL Neon.
- NextAuth.
- Vercel.
- Vercel Blob.
- Web Push/VAPID.

## Correcoes

- Ajustes de seguranca e consistencia acumulados ate RC1.
- Hardening de diagnosticos, dashboard e push notifications.
- Melhor rastreabilidade operacional por documentacao.
- Isolamento dos artigos da Central de Ajuda pelo topico selecionado.
- Restauracao do comportamento de expandir e recolher categorias do Dashboard.
- Remocao do item Contribuicoes do menu lateral, preservando a rota.
- Aplicacao da ordem, visibilidade e permissoes do Perfil de Acesso no Dashboard Portal.

## Limitacoes Conhecidas

- Smoke test automatizado nao substitui validacao manual autenticada completa.
- Push Notifications deve ser validado com dispositivo de teste antes de publicacao final.
- Rollback de banco exige backup validado e decisao operacional explicita.
- Algumas melhorias medias e baixas conhecidas ficam fora desta sprint.
