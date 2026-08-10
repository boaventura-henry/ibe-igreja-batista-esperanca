# Badge de notificacoes do PWA

O badge numerico usa `src/lib/app-badge.ts` como fonte unica para a Badging API. A contagem e fornecida pelo hook
`useUnreadNotificationCount`, que reutiliza o polling, foco, visibilidade e eventos de mutacao ja existentes. Nenhum
intervalo ou consulta adicional foi criado.

Somente inteiros seguros maiores ou iguais a zero sao enviados ao navegador. Valores invalidos sao ignorados; zero
limpa o badge. Ausencia da API, erros do navegador e navegadores sem suporte sao tratados silenciosamente.

O Service Worker aceita `unreadCount` opcional em payloads Push futuros. O envio automatico atual nao calcula esse campo,
pois fazer uma consulta adicional por destinatario criaria custo e risco de divergencia sem beneficio no backend. Ao
abrir, focar ou retornar ao app, o contador oficial e sincronizado. Logout e troca obrigatoria de senha limpam o badge.

Ao sair, o snapshot compartilhado tambem e resetado. Isso evita que uma nova conta herde visualmente o contador da conta
anterior durante a primeira sincronizacao. Nunca utilizar o badge atual + 1 como fonte de verdade.
