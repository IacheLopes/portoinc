-- ============================================================
--  Migração 0002 - Acesso ao sistema
--  Cria permissões, sessões e liga cada função às suas permissões.
-- ============================================================

-- ------------------------------------------------------------
--  Novos campos do usuário
-- ------------------------------------------------------------
ALTER TABLE "usuarios" ADD COLUMN "telefone" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "precisa_trocar_senha" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuarios" ADD COLUMN "ultimo_acesso" TIMESTAMP(3);

CREATE INDEX "usuarios_ativo_idx" ON "usuarios"("ativo");

-- ------------------------------------------------------------
--  Permissões
-- ------------------------------------------------------------
CREATE TABLE "permissoes" (
    "id"     TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome"   TEXT NOT NULL,
    "grupo"  TEXT NOT NULL,
    CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissoes_codigo_key" ON "permissoes"("codigo");

CREATE TABLE "funcoes_permissoes" (
    "funcao_id"    TEXT NOT NULL,
    "permissao_id" TEXT NOT NULL,
    CONSTRAINT "funcoes_permissoes_pkey" PRIMARY KEY ("funcao_id","permissao_id")
);

ALTER TABLE "funcoes_permissoes"
    ADD CONSTRAINT "funcoes_permissoes_funcao_id_fkey"
    FOREIGN KEY ("funcao_id") REFERENCES "funcoes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "funcoes_permissoes"
    ADD CONSTRAINT "funcoes_permissoes_permissao_id_fkey"
    FOREIGN KEY ("permissao_id") REFERENCES "permissoes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
--  Sessões (tokens de renovação)
-- ------------------------------------------------------------
CREATE TABLE "sessoes" (
    "id"          TEXT NOT NULL,
    "usuario_id"  TEXT NOT NULL,
    "token_hash"  TEXT NOT NULL,
    "dispositivo" TEXT,
    "expira_em"   TIMESTAMP(3) NOT NULL,
    "revogada_em" TIMESTAMP(3),
    "criada_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");
CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes"("usuario_id");
CREATE INDEX "sessoes_expira_em_idx" ON "sessoes"("expira_em");

ALTER TABLE "sessoes"
    ADD CONSTRAINT "sessoes_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
--  Catálogo de permissões
-- ------------------------------------------------------------
INSERT INTO "permissoes" ("id","codigo","nome","grupo") VALUES
  ('22222222-2222-4222-8222-000000000001','sistema.status',       'Ver o status do sistema',        'Sistema'),
  ('22222222-2222-4222-8222-000000000002','sistema.integracoes',  'Configurar integrações',         'Sistema'),
  ('22222222-2222-4222-8222-000000000003','usuarios.ver',         'Ver usuários',                   'Sistema'),
  ('22222222-2222-4222-8222-000000000004','usuarios.gerenciar',   'Criar e editar usuários',        'Sistema'),
  ('22222222-2222-4222-8222-000000000005','funcoes.gerenciar',    'Gerenciar funções e permissões', 'Sistema'),

  ('22222222-2222-4222-8222-000000000010','obras.ver',            'Ver obras',                      'Cadastros'),
  ('22222222-2222-4222-8222-000000000011','obras.gerenciar',      'Criar e editar obras',           'Cadastros'),
  ('22222222-2222-4222-8222-000000000012','materiais.ver',        'Ver materiais e serviços',       'Cadastros'),
  ('22222222-2222-4222-8222-000000000013','materiais.gerenciar',  'Criar e editar materiais',       'Cadastros'),
  ('22222222-2222-4222-8222-000000000014','fornecedores.ver',     'Ver fornecedores',               'Cadastros'),
  ('22222222-2222-4222-8222-000000000015','fornecedores.gerenciar','Criar e editar fornecedores',   'Cadastros'),
  ('22222222-2222-4222-8222-000000000016','alcadas.gerenciar',    'Configurar limites de alçada',   'Cadastros'),

  ('22222222-2222-4222-8222-000000000020','solicitacoes.criar',   'Abrir solicitação de compra',    'Compras'),
  ('22222222-2222-4222-8222-000000000021','solicitacoes.ver_todas','Ver solicitações de todos',     'Compras'),
  ('22222222-2222-4222-8222-000000000022','solicitacoes.aprovar', 'Aprovar ou reprovar solicitações','Compras'),
  ('22222222-2222-4222-8222-000000000023','cotacoes.gerenciar',   'Montar e conduzir cotações',     'Compras'),
  ('22222222-2222-4222-8222-000000000024','pedidos.gerenciar',    'Emitir pedidos de compra',       'Compras'),

  ('22222222-2222-4222-8222-000000000030','recebimento.registrar','Registrar recebimento de material','Almoxarifado'),
  ('22222222-2222-4222-8222-000000000031','estoque.ver',          'Consultar estoque',              'Almoxarifado'),
  ('22222222-2222-4222-8222-000000000032','estoque.movimentar',   'Registrar entrada e saída',      'Almoxarifado'),

  ('22222222-2222-4222-8222-000000000040','financeiro.ver',       'Ver contas a pagar',             'Financeiro'),
  ('22222222-2222-4222-8222-000000000041','financeiro.gerenciar', 'Lançar e baixar contas',         'Financeiro'),

  ('22222222-2222-4222-8222-000000000050','locacao.ver',          'Ver equipamentos locados',       'Locação'),
  ('22222222-2222-4222-8222-000000000051','locacao.gerenciar',    'Contratar e devolver locação',   'Locação'),

  ('22222222-2222-4222-8222-000000000060','relatorios.ver',       'Ver relatórios',                 'Relatórios')
ON CONFLICT ("id") DO NOTHING;

-- ------------------------------------------------------------
--  O que cada função pode fazer
-- ------------------------------------------------------------

-- Administrador: tudo.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id" FROM "funcoes" f CROSS JOIN "permissoes" p
WHERE f."codigo" = 'ADMINISTRADOR'
ON CONFLICT DO NOTHING;

-- Solicitante: abre pedido e consulta o básico.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id" FROM "funcoes" f CROSS JOIN "permissoes" p
WHERE f."codigo" = 'SOLICITANTE'
  AND p."codigo" IN ('solicitacoes.criar','obras.ver','materiais.ver','estoque.ver')
ON CONFLICT DO NOTHING;

-- Gestor de obra: aprova e acompanha a obra.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id" FROM "funcoes" f CROSS JOIN "permissoes" p
WHERE f."codigo" = 'GESTOR_OBRA'
  AND p."codigo" IN ('solicitacoes.criar','solicitacoes.ver_todas','solicitacoes.aprovar',
                     'obras.ver','materiais.ver','estoque.ver','locacao.ver','relatorios.ver')
ON CONFLICT DO NOTHING;

-- Comprador: conduz a compra do início ao pagamento.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id" FROM "funcoes" f CROSS JOIN "permissoes" p
WHERE f."codigo" = 'COMPRADOR'
  AND p."codigo" IN ('solicitacoes.ver_todas','cotacoes.gerenciar','pedidos.gerenciar',
                     'fornecedores.ver','fornecedores.gerenciar','materiais.ver','materiais.gerenciar',
                     'obras.ver','estoque.ver','financeiro.ver','financeiro.gerenciar',
                     'locacao.ver','locacao.gerenciar','relatorios.ver')
ON CONFLICT DO NOTHING;

-- Engenheiro: especifica tecnicamente e aprova.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id" FROM "funcoes" f CROSS JOIN "permissoes" p
WHERE f."codigo" = 'ENGENHEIRO'
  AND p."codigo" IN ('solicitacoes.criar','solicitacoes.ver_todas','solicitacoes.aprovar',
                     'materiais.ver','materiais.gerenciar','obras.ver','estoque.ver','relatorios.ver')
ON CONFLICT DO NOTHING;

-- Fundador: aprova valores altos e enxerga os números.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id" FROM "funcoes" f CROSS JOIN "permissoes" p
WHERE f."codigo" = 'FUNDADOR'
  AND p."codigo" IN ('solicitacoes.ver_todas','solicitacoes.aprovar','obras.ver','estoque.ver',
                     'financeiro.ver','locacao.ver','relatorios.ver')
ON CONFLICT DO NOTHING;

-- Almoxarife: recebe e controla o estoque.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id" FROM "funcoes" f CROSS JOIN "permissoes" p
WHERE f."codigo" = 'ALMOXARIFE'
  AND p."codigo" IN ('solicitacoes.criar','recebimento.registrar','estoque.ver','estoque.movimentar',
                     'materiais.ver','obras.ver','locacao.ver')
ON CONFLICT DO NOTHING;

-- Fornecedor: NÃO entra pelo login. Acessa por link com prazo de validade.
-- Por isso fica sem nenhuma permissão interna.
