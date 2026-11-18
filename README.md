# ecommerce-perfumaria

Site/loja e painel administrativo de uma perfumaria artesanal, em monorepo Next.js.

> Versão de portfólio anonimizada de um projeto desenvolvido para cliente; marcas e dados reais removidos.
> A marca "Perfumaria Exemplo", os produtos e as imagens (placeholders) são fictícios.

## O que faz

- **Site público (`apps/site`)**: vitrine, loja com filtros (linha, família olfativa, nota), página de produto e sacola que vira mensagem de WhatsApp. Só lê o banco.
- **Painel (`apps/admin`)**: app e deploy separados, com login + 2FA. Cria/edita produtos e categorias, variações (ml/g/un), preço e estoque, destaques, fotos (inclusive em lote), pedidos, histórico de alterações, usuários e sessões.
- **Importação**: planilha CSV (exporta → edita → envia) ou foto/PDF/texto lido por IA (Gemini, opcional), sempre com prévia antes de salvar.
- Ao salvar, o painel chama `POST /api/revalidate` no site (segredo compartilhado) e o catálogo atualiza na hora.
- Sem `DATABASE_URL`, o site roda com o catálogo de demonstração de `packages/db/src/catalog-seed.ts`.

## Destaques técnicos

- Modelo **item × categoria = produto** (`fragrances` × `product_lines`), com variações, preço `null` = "sob consulta".
- Better Auth com 2FA (TOTP), sem cadastro público; senha mínima de 12 caracteres checada no Have I Been Pwned; rate limit no banco; cookies `SameSite=Strict`.
- CSP com nonce, HSTS, `X-Frame-Options: DENY`, `noindex` no painel; toda ação confere sessão + 2FA no servidor.
- Papéis Postgres de menor privilégio: o site só lê o catálogo (sem colunas internas); o painel escreve no catálogo e só acrescenta no histórico. `pnpm neon:setup` aplica migrações, papéis, permissões, seed e roda um teste de permissões.
- Env validada com zod; CI com lint, typecheck e build; Dependabot.

## Stack

Next.js 16 (App Router) · React · Tailwind CSS 4 · Drizzle ORM · Postgres (Neon) · Better Auth · zod · pnpm workspaces · Vercel (Blob para fotos).

## Como rodar

```bash
pnpm install
pnpm dev          # site   → http://localhost:3000 (sem banco usa o catálogo de demonstração)
pnpm dev:admin    # painel → http://localhost:3001 (requer banco)
pnpm lint && pnpm typecheck && pnpm build
```

Configuração: copie os `.env.example` de `apps/site`, `apps/admin` e `packages/db` para `.env.local` e preencha.
Com a CLI do Neon logada e `NEON_PROJECT_ID` exportado, `pnpm neon:setup dev` cria papéis e gera os `.env.local` com senhas aleatórias.
Contas do painel: `pnpm admin:usuario criar dev "Nome" email@exemplo.com admin` (senha provisória exibida uma vez).

## Estrutura

```
apps/site/          site público (loja) — só leitura do banco
apps/admin/         painel admin — auth, 2FA, catálogo, importação, pedidos, histórico
packages/db/        schema Drizzle, migrações, seed, regras de pedido, papéis SQL (roles/), scripts Neon
.github/            CI e Dependabot
```
