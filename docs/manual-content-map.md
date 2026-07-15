# Mapa de conteúdo da Central de Ajuda

O conteúdo vive em `src/content/help/help-content.ts` e é filtrado no cliente pela sessão e pelos `permissionCodes` disponíveis no token. Não existe tabela ou migration para o manual.

## Fontes auditadas

- Rotas em `src/app/**` e `src/app/(app)/**`.
- Rotas e componentes do Portal em `src/app/(portal)/**` e `src/components/portal/**`.
- Menus em `src/lib/navigation.ts`, `src/components/AppShell.tsx` e `src/components/portal/PortalShell.tsx`.
- Permissões em `src/lib/permissions.ts`.
- Fluxos de autenticação em `src/app/login`, `src/app/recuperar-senha`, `src/app/trocar-senha` e `src/app/solicitar-acesso`.
- PWA documentado em `README.md`, manifest e componentes `src/components/pwa/**`.

## Categorias e artigos

Cada linha abaixo corresponde a um `id` real em `src/content/help/help-content.ts`. Artigos `MEMBER` e `ADMIN` exigem autenticação e todas as permissões listadas; artigos `PUBLIC` não exigem sessão.

| Categoria | ID | Título | Audiência | Permissões | Rota relacionada |
| --- | --- | --- | --- | --- | --- |
| Primeiros passos | `acessar-sistema` | Como acessar o sistema | PUBLIC | - | `/login` |
| Primeiros passos | `solicitar-acesso` | Como solicitar acesso | PUBLIC | - | `/solicitar-acesso` |
| Primeiros passos | `acessar-ajuda` | Como acessar a Central de Ajuda | PUBLIC | - | `/ajuda` |
| Acesso e senha | `login-telefone-cpf` | Como usar telefone ou CPF no login | PUBLIC | - | `/login` |
| Acesso e senha | `mostrar-senha` | Como mostrar ou ocultar a senha | PUBLIC | - | `/login` |
| Acesso e senha | `recuperar-senha` | Como recuperar a senha | PUBLIC | - | `/recuperar-senha` |
| Acesso e senha | `trocar-senha-temporaria` | Como trocar uma senha temporária | PUBLIC | - | `/trocar-senha` |
| Acesso e senha | `problemas-login` | Problemas comuns de login | PUBLIC | - | `/login` |
| Aplicativo no celular | `instalar-android` | Como instalar o aplicativo no Android | PUBLIC | - | `/` |
| Aplicativo no celular | `instalar-iphone` | Como adicionar o aplicativo à tela inicial no iPhone | PUBLIC | - | `/` |
| Aplicativo no celular | `atualizar-aplicativo` | Como atualizar o aplicativo | PUBLIC | - | `/` |
| Portal do Membro | `portal-acesso` | Como acessar o Portal do Membro | MEMBER | `memberPortal.view` | `/portal` |
| Portal do Membro | `aniversariantes-portal` | Como visualizar aniversariantes | MEMBER | `memberPortal.view` | `/portal` |
| Meu cadastro | `portal-cadastro` | Como alterar meus dados | MEMBER | `memberPortal.updateProfile` | `/portal/meu-cadastro` |
| Meu cadastro | `portal-usuario` | Como alterar meus dados de usuário | MEMBER | `memberAccount.view` | `/portal/meu-usuario` |
| Escalas | `minhas-escalas` | Como visualizar minhas escalas | MEMBER | `mySchedule.view` | `/portal/minhas-escalas` |
| Escalas | `repertorio-portal` | Como visualizar o repertório | MEMBER | `mySchedule.view` | `/portal/minhas-escalas` |
| Escalas | `escalas-admin` | Como consultar escalas | ADMIN | `schedule.view` | `/escalas` |
| Escalas | `criar-escala` | Como criar e publicar uma escala | ADMIN | `schedule.create`, `schedule.update`, `schedule.publish` | `/escalas` |
| Músicas e repertório | `repertorio-admin` | Como adicionar músicas ao repertório | ADMIN | `song.view`, `schedule.update` | `/escalas` |
| Músicas e repertório | `cadastrar-musica` | Como cadastrar uma música | ADMIN | `song.create` | `/musicas` |
| Comunicados | `avisos-portal` | Como visualizar e marcar comunicados como lidos | MEMBER | `portalAnnouncement.view` | `/portal/avisos` |
| Comunicados | `comunicados-admin` | Como consultar comunicados | ADMIN | `announcement.view` | `/comunicados` |
| Comunicados | `gerenciar-comunicados` | Como criar e publicar comunicados | ADMIN | `announcement.create`, `announcement.update`, `announcement.publish`, `announcement.archive` | `/comunicados` |
| Financeiro e contribuições | `contribuicoes-portal` | Como visualizar e exportar minhas contribuições | MEMBER | `memberContribution.view` | `/portal/minhas-contribuicoes` |
| Financeiro e contribuições | `financeiro-admin` | Como consultar lançamentos financeiros | ADMIN | `financialEntry.view` | `/financeiro/lancamentos` |
| Membros | `membros-admin` | Como consultar membros | ADMIN | `member.view` | `/membros` |
| Membros | `cadastrar-membro` | Como cadastrar ou editar um membro | ADMIN | `member.create`, `member.update` | `/membros` |
| Usuários e permissões | `usuarios-admin` | Como consultar usuários | ADMIN | `user.view` | `/usuarios` |
| Usuários e permissões | `criar-usuario` | Como criar ou atualizar um usuário | ADMIN | `user.create`, `user.update` | `/usuarios` |
| Usuários e permissões | `perfis-acesso` | Como consultar perfis de acesso | ADMIN | `accessRole.view` | `/perfis-acesso` |
| Ministérios | `ministerios-admin` | Como consultar ministérios | ADMIN | `ministry.view` | `/ministerios` |
| Ministérios | `gerenciar-ministerios` | Como cadastrar e organizar ministérios | ADMIN | `ministry.create`, `ministry.update` | `/ministerios` |
| Ministérios | `vincular-ministerio` | Como vincular um membro a um ministério | ADMIN | `memberMinistry.create`, `memberMinistry.update` | `/membros-ministerios` |
| Eventos | `eventos-admin` | Como consultar eventos | ADMIN | `event.view` | `/eventos` |
| Eventos | `gerenciar-eventos` | Como criar e publicar eventos | ADMIN | `event.create`, `event.update`, `event.publish` | `/eventos` |
| Relatórios | `relatorios-admin` | Como consultar relatórios | ADMIN | `report.view` | `/relatorios` |
| Relatórios | `exportar-relatorios` | Como exportar relatórios | ADMIN | `report.view`, `report.export` | `/relatorios` |

## Rotas

- Central pública e autenticada: `/ajuda`.
- Artigo direto: `/ajuda?artigo=<id>`.
- Contextos relacionados: `/login`, `/solicitar-acesso`, `/recuperar-senha`, `/portal`, `/escalas`, `/musicas`.
