# IBE 0.2.0 RC2 - Rollback

Este documento descreve o procedimento de rollback. Nao execute rollback sem autorizacao operacional.

## Quando Acionar

Acione rollback quando houver:

- Falha critica no login.
- Falha critica no banco.
- Erro que impede uso do Dashboard ou Portal.
- Exposicao de dado sensivel.
- Migration aplicada incorretamente.
- Falha de Push com envio indevido.
- Erro 500 recorrente em fluxo essencial.

## Como Interromper Deploy

1. Pare novas acoes manuais.
2. Registre o horario da falha.
3. Identifique o deploy afetado na Vercel.
4. Bloqueie novas alteracoes ate a triagem.
5. Comunique o responsavel tecnico.

## Como Verificar a Falha

1. Confirmar URL afetada.
2. Verificar status da Vercel.
3. Verificar `/api/health/db`.
4. Verificar logs server-side da Vercel.
5. Verificar ultimo commit publicado.
6. Verificar migrations aplicadas.
7. Separar falha de aplicacao, banco, variavel ou rede.

## Como Retornar a Aplicacao

1. Identificar ultimo deploy estavel.
2. Reatribuir o dominio de producao ao deploy estavel pela Vercel.
3. Confirmar que a URL oficial responde.
4. Validar login, Dashboard, Portal e Health.
5. Registrar o hash restaurado.

## Como Restaurar Banco

1. Nao executar comandos destrutivos sem backup validado.
2. Confirmar backup disponivel no Neon.
3. Criar plano de restauracao com horario alvo.
4. Restaurar em ambiente seguro ou branch database quando possivel.
5. Validar schema e dados essenciais.
6. Somente depois apontar producao para o banco restaurado.

## Validacao Pos-Rollback

- [ ] URL oficial responde.
- [ ] Login Admin funciona.
- [ ] Login Membro funciona.
- [ ] Dashboard abre.
- [ ] Portal abre.
- [ ] `/api/health/db` conectado.
- [ ] APIs protegidas continuam protegidas.
- [ ] Uploads funcionam.
- [ ] Push nao envia indevidamente.
- [ ] Erro original nao ocorre.

## Registro

- Deploy com falha:
- Deploy restaurado:
- Banco restaurado: sim / nao
- Responsavel:
- Data/hora:
- Observacoes:
