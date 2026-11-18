-- Loja — papel do PAINEL ADMIN (loja_admin). Aplicado por `pnpm neon:setup <branch>`.
-- Criado por SQL (fora do neon_superuser): sem DDL, sem criar papéis, sem superusuário.
-- Só o painel usa estas credenciais; o site público continua com loja_site (somente leitura).

GRANT USAGE ON SCHEMA public TO loja_admin;

-- Catálogo: leitura e escrita completas (inclui referência interna das fragrâncias).
GRANT SELECT, INSERT, UPDATE, DELETE ON product_lines, fragrances, products, product_variants, product_images TO loja_admin;

-- Autenticação do painel (Better Auth).
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_user, admin_session, admin_account, admin_verification, admin_two_factor, admin_rate_limit TO loja_admin;

-- Registro de alterações: só acrescenta e lê. Ninguém do painel apaga ou edita o histórico.
GRANT SELECT, INSERT ON audit_log TO loja_admin;

-- Pedidos: o painel lê e atualiza status/rastreio/observação. Não cria nem apaga pedidos
-- (quem cria é o checkout do site; quem confirma pagamento é o webhook).
GRANT SELECT ON orders, order_items, payment_events TO loja_admin;
GRANT UPDATE (status, shipped_at, canceled_at, tracking_code, internal_notes, updated_at) ON orders TO loja_admin;
-- Baixa/devolução de estoque ao cancelar é feita pelo painel em product_variants (já coberto acima).

-- Sequências (ids serial) das tabelas onde o painel insere.
GRANT USAGE, SELECT ON SEQUENCE
  product_lines_id_seq, fragrances_id_seq, products_id_seq, product_variants_id_seq,
  product_images_id_seq, audit_log_id_seq
TO loja_admin;
