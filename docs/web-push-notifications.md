# Web Push Notifications

## Arquitetura

O canal Web Push complementa a Central de Notificacoes. A notificacao in-app continua sendo a fonte persistente e e criada dentro da transacao da regra de negocio. Somente os IDs efetivamente criados sao despachados depois do commit; uma indisponibilidade do provedor Push nao desfaz a operacao nem remove a notificacao interna.

```text
NotificationPublisher
        |
        v
NotificationService
   |             |
   v             v
In-App       despacho pos-commit
Notification      |
                  v
       PushNotificationService
                  |
                  v
          PushSubscription
                  |
                  v
           Push Provider
                  |
                  v
          Service Worker
                  |
                  v
       Native Notification
```

O catalogo em `src/lib/notification-catalog.ts` e a unica fonte para destinos. O payload aceita apenas rotas internas; o Service Worker valida novamente a URL antes de focar ou abrir uma janela. A `tag` combina tipo e entidade para substituir visualmente avisos nativos redundantes sem apagar o historico in-app.

## Variaveis VAPID

Configure em cada ambiente, fora do Git:

```dotenv
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:administracao@dominio-da-igreja
```

A chave publica e incorporada ao cliente. A chave privada permanece exclusiva do servidor. Nunca registre chaves, `Authorization`, endpoints completos, `p256dh`, `auth`, `DATABASE_URL` ou `DIRECT_URL`.

## Permissao e inscricao

1. O cliente verifica Service Worker, PushManager, Notifications API, `ServiceWorkerRegistration.pushManager`, contexto seguro e suporte do navegador.
2. A permissao e solicitada somente depois de o usuario clicar em **Ativar notificacoes**.
3. `default` permite a solicitacao explicita; `granted` permite reconciliar/criar a subscription; `denied` mostra orientacao sem repetir o prompt.
4. O cliente consulta `getSubscription()` antes de `subscribe()` e sincroniza a subscription existente ao abrir a tela.
5. As APIs usam o usuario da sessao. `userId` nao faz parte do payload.

Um usuario pode cadastrar varios navegadores ou dispositivos. O endpoint e unico e nao pode mudar de proprietario silenciosamente. No logout, a associacao do dispositivo e revogada no backend e a subscription fisica e removida. Se uma troca de conta encontrar um endpoint ainda pertencente ao usuario anterior, o navegador o remove e exige novo registro explicito.

O evento `pushsubscriptionchange` tenta renovar e sincronizar a subscription quando o navegador fornece a chave anterior. Como o suporte varia, a aplicacao nao depende dele: a reconciliacao ao abrir continua sendo o mecanismo principal.

## Preferencias e entrega

`NotificationPreference.pushEnabled` controla o canal Web Push da conta e permanece separado de `InAppNotificationPreference`. Somente usuarios ativos, notificacoes in-app elegiveis, preferencia Push habilitada e subscriptions ativas participam do envio. Cada endpoint recebe no maximo uma tentativa por notificacao.

Matriz efetiva:

| In-app por tipo | Push da conta | Resultado |
| --- | --- | --- |
| Ativado | Ativado | Persiste na Central e tenta Web Push nos dispositivos ativos |
| Ativado | Desativado | Persiste somente na Central |
| Desativado | Ativado | Nao persiste e nao envia Push, pois o registro in-app e a fonte do despacho |
| Desativado | Desativado | Nao persiste e nao envia Push |

O despacho automatico resolve o lote persistido em uma consulta, carrega preferencias Push e subscriptions em duas consultas agrupadas e nao mantem a transacao de negocio aberta durante chamadas externas. Os registros de auditoria sao gravados por notificacao e dispositivo; portanto, o custo de escrita cresce linearmente com a quantidade de endpoints, sem N+1 para descobrir destinatarios.

Respostas 404 e 410 confirmam endpoint invalido e desativam a subscription. Timeout, 429, 500, 502 e 503 sao falhas transitorias: ficam registradas de forma sanitizada, mas nao removem o dispositivo. A falha de um dispositivo nao impede os demais.

## Service Worker

O `public/sw.js` preserva cache/offline e nao armazena APIs autenticadas. O evento `push` usa fallback para payload ausente ou malformado, limita titulo/corpo, aceita icones internos e chama `showNotification`. Quando um payload confiavel incluir `unreadCount`, o Service Worker tenta atualizar o badge do PWA com deteccao de suporte e falha silenciosa. Em `notificationclick`, a notificacao e fechada, uma janela existente recebe foco e navega para a rota interna; sem cliente aberto, uma nova janela e criada.

No fluxo normal, o contador exato vem de `/api/notifications/unread-count` e e sincronizado pelo hook compartilhado `useUnreadNotificationCount`, que ja concentra polling, foco, visibilidade e eventos de leitura. O envio automatico nao faz uma consulta adicional por destinatario apenas para incluir `unreadCount` no Push; assim evita N+1 e mantem a notificacao in-app como fonte de verdade. Ao abrir ou retornar ao app, o contador real atualiza o badge. Logout e troca obrigatoria de senha limpam o badge de forma segura.

## Android

1. Instale o PWA ou abra em Chrome sobre HTTPS.
2. Entre no Portal, acesse **Meu Usuario** e clique em **Ativar notificacoes**.
3. Aceite a permissao e conclua o teste do dispositivo.
4. Feche ou coloque o PWA em segundo plano.
5. Gere uma notificacao funcional para o dispositivo de teste.
6. Confirme o aviso nativo, toque nele e valide a rota interna correta.

## iPhone e iPad

1. Use uma versao compativel do iOS/iPadOS e abra o site no Safari.
2. Adicione o IBE a Tela de Inicio.
3. Abra pelo icone instalado; Web Push nao e tratado como disponivel em uma aba comum.
4. Ative as notificacoes por acao explicita e aceite a permissao.
5. Feche o PWA, gere um aviso de teste, confirme o recebimento e valide o destino ao tocar.

## Troubleshooting

- **Navegador incompativel:** confirme HTTPS, PWA instalado no iOS e suporte a Service Worker/PushManager.
- **Permissao bloqueada:** reative nas configuracoes do navegador ou sistema; a aplicacao nao pode contornar `denied`.
- **VAPID indisponivel:** confirme as tres variaveis no mesmo ambiente e refaca o build quando a chave publica mudar.
- **Dispositivo de outra conta:** saia corretamente e registre novamente na conta atual.
- **404/410:** o dispositivo foi desativado automaticamente e deve ser registrado outra vez.
- **Falha transitoria:** preserve a subscription e consulte o historico/saude de Push antes de reenviar.

Execute `npm run test:web-push` junto das regressoes de notificacoes, escalas, reminders e lifecycle.
