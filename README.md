# IBE - Igreja Batista Esperanca

Aplicacao web administrativa para a Igreja Batista Esperanca, criada com Next.js, TypeScript, Tailwind CSS, Prisma ORM e PostgreSQL Neon.

## Stack

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL Neon
- Deploy na Vercel

## Como rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

Para validar o build de producao:

```bash
npm run build
```

## Configurando o Neon

1. Crie uma conta em [Neon](https://neon.tech/).
2. Crie um novo projeto PostgreSQL.
3. Abra a area **Connection details** do projeto.
4. Copie a URL pooled para `DATABASE_URL`.
5. Copie a URL direct/unpooled para `DIRECT_URL`.

O Prisma usa `DATABASE_URL` para conexoes normais da aplicacao e `DIRECT_URL` para operacoes diretas, como migrations.

## Variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto usando `.env.example` como base:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
ADMIN_USERNAME="ADMIN"
ADMIN_NAME="Administrador"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="UseUmaSenhaForteAqui"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_token"
```

Nao coloque credenciais reais no repositorio. O arquivo `.env` esta no `.gitignore`.

## Prisma

Gere o client Prisma:

```bash
npm run prisma:generate
```

Crie e aplique migrations no banco Neon:

```bash
npm run prisma:migrate
```

Abra o Prisma Studio:

```bash
npm run prisma:studio
```

## Deploy na Vercel

1. Suba o repositorio para o GitHub.
2. Na [Vercel](https://vercel.com/), crie um novo projeto importando o repositorio.
3. Configure as variaveis `DATABASE_URL` e `DIRECT_URL` em **Project Settings > Environment Variables**.
4. Use o comando de build padrao:

```bash
npm run build
```

5. Publique o projeto.

O script `build` executa `prisma generate` antes de `next build`, garantindo que o Prisma Client exista durante o build da Vercel.

## Imagens com Vercel Blob

Fotos de membros e imagens de ministerios usam Vercel Blob. Crie um Blob Store no projeto da Vercel e configure `BLOB_READ_WRITE_TOKEN` nos ambientes necessários. Sem essa variavel, as rotas de upload retornam erro amigavel e o cadastro ainda permite informar uma URL manualmente.

## PWA

O IBE esta preparado como Progressive Web App instalavel.

No Android, abra a URL de producao no Chrome e use a opcao **Instalar app** ou **Adicionar a tela inicial**. No iOS, abra no Safari, toque em **Compartilhar** e escolha **Adicionar a Tela de Inicio**.

O app possui manifest, icones, service worker e uma pagina offline basica. Quando estiver sem conexao, rotas publicas essenciais e assets estaticos podem continuar disponiveis; paginas administrativas e APIs autenticadas nao sao cacheadas para evitar exposicao de dados sensiveis.

Notificacoes push ainda nao foram implementadas nesta fase.

## Painel de aniversariantes

O dashboard administrativo e o Portal do Membro exibem aniversariantes ativos dos proximos sete dias e do mes atual, usando a data do servidor no banco. Membros nascidos em 29/02 aparecem em 29/02 nos anos bissextos e em 28/02 nos demais anos. O portal recebe apenas nome, foto e ministerio principal; dados cadastrais e de contato nao sao expostos.

## Usuario administrador inicial

O seed cria ou atualiza o administrador inicial usando variaveis de ambiente:

- `ADMIN_USERNAME`: usuario de login, sempre normalizado em maiusculo.
- `ADMIN_NAME`: nome exibido no sistema.
- `ADMIN_EMAIL`: e-mail cadastral.
- `ADMIN_PASSWORD`: senha com pelo menos 6 caracteres usada para gerar o hash.

Execute:

```bash
npm run prisma:seed
```

O login do sistema aceita telefone ou CPF com senha. O identificador legado `ADMIN_USERNAME` continua aceito para compatibilidade do administrador e usuarios antigos. O e-mail permanece apenas como informacao cadastral.

## Estrutura inicial

- `/login`: entrada inicial do sistema
- `/dashboard`: indicadores gerais
- `/membros`: cadastro de membros
- `/ministerios`: equipes e liderancas
- `/eventos`: agenda da igreja
- `/contribuicoes`: contribuicoes, ofertas e dizimos

## Observacoes de seguranca

- O projeto nao usa `localStorage` como banco.
- Credenciais reais devem ficar apenas em variaveis de ambiente.
- O schema Prisma esta preparado para PostgreSQL Neon.
