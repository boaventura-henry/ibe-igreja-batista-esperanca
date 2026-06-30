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

## Usuario administrador inicial

O seed cria ou atualiza o administrador inicial usando variaveis de ambiente:

- `ADMIN_USERNAME`: usuario de login, sempre normalizado em maiusculo.
- `ADMIN_NAME`: nome exibido no sistema.
- `ADMIN_EMAIL`: e-mail cadastral.
- `ADMIN_PASSWORD`: senha forte usada para gerar o hash.

Execute:

```bash
npm run prisma:seed
```

O login do sistema usa `username + senha`. O e-mail permanece apenas como informacao cadastral.

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
