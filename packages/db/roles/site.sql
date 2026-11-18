-- Loja — papel restrito para o site (rodar no SQL Editor do Neon, como dono do banco,
-- DEPOIS de `pnpm db:migrate`).
--
-- 1) Crie o papel POR SQL, nunca pelo Console/CLI do Neon: papéis criados pelo
--    Console entram no grupo neon_superuser e conseguem ler/alterar tudo.
--      CREATE ROLE loja_site WITH LOGIN PASSWORD '<senha aleatória longa>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
--    Confira: SELECT r.rolname FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid
--             JOIN pg_roles u ON u.oid=m.member WHERE u.rolname='loja_site';  -- deve voltar vazio
--    Depois de recriar um papel, reinicie o compute da branch (o pooler guarda sessões antigas).
-- 2) GRANTs abaixo — aplicados automaticamente por `pnpm neon:setup <branch>`.

GRANT USAGE ON SCHEMA public TO loja_site;

-- Somente leitura nas tabelas públicas do catálogo.
GRANT SELECT ON product_lines, products, product_variants, product_images TO loja_site;

-- Em fragrances, leitura coluna a coluna: o site NÃO enxerga internal_reference
-- (referência olfativa de uso interno). Defesa em profundidade além do código.
GRANT SELECT (
  id, slug, name, family, gender, notes_top, notes_heart, notes_base,
  description, active, created_at, updated_at
) ON fragrances TO loja_site;

-- Sem INSERT/UPDATE/DELETE e sem DDL para o site.
-- Novas tabelas NÃO recebem acesso automático: conceda explicitamente quando criar.

-- Conferência:
-- SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'loja_site';
-- SELECT table_name, column_name FROM information_schema.column_privileges WHERE grantee = 'loja_site' AND table_name = 'fragrances';

-- Tabelas do painel (admin_*, audit_log) e de pedidos: o site NÃO recebe acesso aqui.
-- Na fase 2 (checkout), o site ganhará um papel próprio (loja_checkout) com INSERT
-- em orders/order_items/payment_events — separado deste papel de leitura.
