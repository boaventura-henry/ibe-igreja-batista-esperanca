# Fundacao de visitantes

O dominio de visitantes usa telefone brasileiro normalizado e data de nascimento civil como identidade. O telefone e armazenado somente com digitos e a data civil usa UTC a meia-noite.

`PUBLIC_SITE_URL` deve usar inicialmente `https://ibe-igreja-batista-esperanca.vercel.app`. Durante a transicao para `https://www.ibearacatuba.com.br`, `VISITOR_ALLOWED_ORIGINS` deve conter ambas as origens HTTPS.

O aviso de privacidade de visitantes inicia em estado `DRAFT`. Nenhuma superficie publica deve ser liberada em Production enquanto seu status nao for `APPROVED` e o texto juridico definitivo nao estiver aprovado.
