# Changelog

Todas as alteracoes relevantes deste projeto serao registradas aqui. O formato segue Keep a Changelog e a versao segue Semantic Versioning.

## [Unreleased]

### Planning

- RBAC por Ministerio para limitar a visualizacao de escalas aos ministerios vinculados ou permitir acesso global.
- Historico de utilizacao das musicas com escala, data, tom, ministro, material e quantidade de usos.
- Arquivamento automatico de escalas, eventos, comunicados e notificacoes, com avaliacao de status calculado por data.

Nenhuma dessas funcionalidades foi implementada neste commit inicial.

## [0.2.0] - 2026-07-23

### Added

- RBAC granular para os dez widgets do dashboard administrativo.
- Configuracao de ordem, tamanho e visibilidade por dispositivo para cada perfil.
- Layout responsivo e agrupamento visual dos widgets por categoria.
- Pre-visualizacao estrutural na administracao de perfis, sem dados reais.
- Pagina autenticada Sobre e versao discreta no shell da aplicacao.
- Metadados centralizados de releases e recursos do aplicativo.
- Modal de novidades por versao publicada.
- Registro da ultima versao visualizada por usuario.
- Roadmap estruturado do sistema.
- Diagnostico administrativo da aplicacao e do schema do banco.
- Historico de releases ampliado na tela Sobre.

### Changed

- O dashboard administrativo passou a ser montado por categorias e layout do perfil.
- O Dashboard Portal passou a respeitar permissoes, visibilidade e ordem dos widgets configuradas no Perfil de Acesso.
- O item Contribuicoes foi removido do menu lateral, preservando sua rota e funcionalidades.

### Fixed

- Artigos da Central de Ajuda agora ficam isolados pelo topico normalizado.
- Categorias do Dashboard voltaram a recolher e expandir visualmente.
- A ordem fixa do Dashboard Portal foi substituida pela ordem configurada no perfil.

### Security

- Permissoes especificas continuam sendo aplicadas antes de qualquer consulta de widget.
- Consultas e dados financeiros permanecem ausentes quando o perfil nao possui autorizacao.
- Diagnosticos tecnicos sao protegidos por permissao especifica.
- Releases nao publicadas nao geram notificacao para usuarios.
- Nenhum dado de conexao, SQL, checksum ou segredo e exposto pelos diagnosticos.

### Database

- Migracao `20260720210000_add_dashboard_widget_rbac` para o catalogo e as permissoes de widgets.
- Migracao `20260720223000_add_dashboard_layout_and_widget_metadata` para layout e metadados visuais.
- Migracao `20260720233000_add_user_last_seen_app_version` para a preferencia de novidades do usuario.

## [0.1.0]

- Base inicial da aplicacao, anterior ao registro estruturado deste changelog.
