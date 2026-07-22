# IBE 0.2.0 RC2 - Smoke Test

Tempo estimado: 20 a 35 minutos.

## Publico

- [ ] Acessar `/`.
- [ ] Confirmar redirecionamento esperado para login quando necessario.
- [ ] Acessar `/login`.
- [ ] Acessar `/ajuda`.
- [ ] Acessar `/solicitar-acesso`.
- [ ] Acessar `/recuperar-senha`.

## Login e Sessao

- [ ] Login Admin.
- [ ] Logout Admin.
- [ ] Login Membro.
- [ ] Logout Membro.
- [ ] Rota protegida redireciona usuario anonimo.
- [ ] Sessao expirada nao acessa dados protegidos.

## Dashboard

- [ ] Dashboard administrativo abre.
- [ ] Widgets aparecem conforme permissao.
- [ ] Indicadores principais carregam.
- [ ] Card de aniversariantes carrega.
- [ ] Erros de widget nao quebram a pagina inteira.

## Portal

- [ ] Portal abre para membro.
- [ ] Minhas escalas abre.
- [ ] Meu cadastro abre.
- [ ] Meu usuario abre.
- [ ] Meus ministerios abre.
- [ ] Avisos abre.
- [ ] Minhas contribuicoes abre.

## Permissoes

- [ ] Usuario sem permissao nao acessa area administrativa.
- [ ] Menus respeitam permissionCodes.
- [ ] APIs protegidas retornam 401/403 sem sessao/permissao.

## Uploads

- [ ] Upload de foto de membro.
- [ ] Upload de imagem de ministerio.
- [ ] Upload de imagem de evento.
- [ ] Arquivo invalido retorna erro amigavel.

## Push

- [ ] Usuario de teste registra dispositivo.
- [ ] Envio de teste chega ao dispositivo.
- [ ] Historico registra log.
- [ ] Painel Saude das Notificacoes atualiza metricas.
- [ ] Nenhum envio em massa foi realizado.

## Roadmap, Sobre e Release Notes

- [ ] Tela Sobre abre.
- [ ] Versao exibida corretamente.
- [ ] Roadmap abre.
- [ ] Release Notes abre.
- [ ] Diagnostico do schema abre somente com permissao.

## Banco e APIs

- [ ] `/api/health/db` retorna connected.
- [ ] `/api/dashboard/admin` protegido.
- [ ] `/api/dashboard/portal` protegido.
- [ ] APIs administrativas nao retornam dados sem sessao.

## Resultado

- Smoke aprovado: sim / nao
- Responsavel:
- Data/hora:
- Pendencias:
