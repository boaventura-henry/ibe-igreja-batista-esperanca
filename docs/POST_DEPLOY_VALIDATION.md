# Validacao pos-deploy da versao 0.2.0

Este documento orienta a validacao controlada da versao 0.2.0 apos o deploy principal e antes da publicacao formal da release.

## Identificacao

- Versao: 0.2.0
- Ambiente: Production
- Data:
- Responsavel:
- Commit:
- URL:
- Migration esperada: `20260720233000_add_user_last_seen_app_version`
- Ultima migration aplicada:
- Resultado final: PENDENTE

## Smoke tecnico

Validar sem depender de dados sensiveis:

- Pagina inicial responde sem erro 500.
- Pagina de login responde HTTP 200.
- Health do banco responde `connected`.
- Rota protegida sem sessao redireciona para login ou retorna 401/403 esperado.
- Middleware nao entra em loop de redirecionamento.
- APIs administrativas exigem autenticacao e permissao.
- APIs do portal exigem autenticacao quando aplicavel.
- Assets publicos carregam sem chunk ausente.
- Pagina Sobre responde conforme o estado da release.
- Nao ha erro Prisma exposto ao usuario.
- Nao ha stack trace ou segredo em resposta publica.

## Administrador

Validar com usuario administrativo autorizado:

- Login com credenciais administrativas.
- Dashboard administrativo carrega.
- Todos os widgets autorizados aparecem.
- Categorias do dashboard aparecem corretamente.
- Layout dos widgets respeita configuracao do perfil.
- Dispositivos e responsividade mantem os widgets acessiveis.
- Perfis de acesso abrem e preservam RBAC.
- Configuracao dos widgets por perfil funciona sem expor dados reais indevidos.
- Pagina Sobre abre.
- Diagnostico tecnico abre somente com permissao.
- Roadmap interno aparece conforme permissao.
- Releases nao publicadas nao disparam modal.
- Painel de notificacoes abre conforme permissao.
- Modulos de membros, eventos, escalas e contribuicoes continuam acessiveis conforme permissao.
- Uploads de imagem continuam funcionando.

## Pastor

Validar com perfil pastoral, quando disponivel:

- Login.
- Dashboard permitido carrega.
- Widgets financeiros sem permissao nao aparecem.
- Membros, agenda e escalas respeitam permissoes do perfil.
- Portal continua acessivel.
- Pagina Sobre aparece.
- Diagnostico tecnico nao aparece sem permissao especifica.

## Secretario

Validar com perfil de secretaria, quando disponivel:

- Login.
- Dashboard nao restrito carrega.
- Membros, eventos e escalas funcionam conforme permissoes.
- Dados financeiros nao autorizados nao aparecem.
- Pagina Sobre aparece.

## Membro

Validar com usuario vinculado a membro:

- Login.
- Portal carrega.
- Perfil do membro carrega somente dados permitidos.
- Preferencias de notificacoes abrem.
- Pagina Sobre publica aparece.
- Roadmap publico nao expoe dados tecnicos.
- Dashboard administrativo nao fica acessivel sem permissao.
- Informacoes tecnicas e financeiras restritas nao aparecem.

## Release Notes

Antes de publicar formalmente 0.2.0:

- Modal de novidades nao deve aparecer.
- Versao deve constar como proxima versao ou nao publicada.
- Pagina Sobre nao deve tratar 0.2.0 como release publicada.

Apos publicar formalmente 0.2.0:

- Usuario com `lastSeenAppVersion` anterior recebe modal.
- Abrir o modal nao marca a versao como vista.
- Clicar em "Entendi" persiste a confirmacao.
- Modal nao reaparece apos refresh ou novo login.
- Usuario novo recebe somente a ultima versao publicada.
- Notas tecnicas nao aparecem para usuario comum.

## Banco e schema

Validar sem imprimir credenciais:

- Banco conectado.
- 28 migrations concluidas.
- Ultima migration aplicada corresponde a `20260720233000_add_user_last_seen_app_version`.
- Prisma migrate status retorna UP_TO_DATE.
- `DashboardWidget` populado.
- `AccessRoleDashboardWidget` populado.
- `AccessRoleDashboardLayout` populado.
- Permissoes da versao existem.
- `system.diagnostics.view` cadastrado.
- `lastSeenAppVersion` preservado para usuarios existentes.

## Observabilidade

Monitorar por pelo menos 30 minutos:

- Logs da Vercel.
- Erros 500.
- Falhas Prisma.
- Falhas de autenticacao inesperadas.
- Erros de carregamento de chunks.
- Falhas no dashboard.
- Falhas de upload.
- Falhas de push notification.
- Aumento incomum de respostas 401 ou 403.
- Erros de migration.
- Erros de seed.

## Resultado

Preencher ao final:

- Resultado: GO / GO COM RESSALVAS / NO-GO
- Rollback necessario: SIM / NAO
- Observacoes:
- Responsavel pela decisao:
- Horario de encerramento:
