-- ============================================================
--  Migracao 0001 - Estrutura inicial
--  Cria usuarios, funcoes e a ligacao entre eles,
--  e ja cadastra as 7 funcoes do fluxo de compras.
-- ============================================================

CREATE TABLE "usuarios" (
    "id"         TEXT NOT NULL,
    "nome"       TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "ativo"      BOOLEAN NOT NULL DEFAULT true,
    "criado_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

CREATE TABLE "funcoes" (
    "id"        TEXT NOT NULL,
    "codigo"    TEXT NOT NULL,
    "nome"      TEXT NOT NULL,
    "descricao" TEXT,
    "sistema"   BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "funcoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "funcoes_codigo_key" ON "funcoes"("codigo");

CREATE TABLE "usuarios_funcoes" (
    "usuario_id" TEXT NOT NULL,
    "funcao_id"  TEXT NOT NULL,
    "criado_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_funcoes_pkey" PRIMARY KEY ("usuario_id","funcao_id")
);

ALTER TABLE "usuarios_funcoes"
    ADD CONSTRAINT "usuarios_funcoes_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usuarios_funcoes"
    ADD CONSTRAINT "usuarios_funcoes_funcao_id_fkey"
    FOREIGN KEY ("funcao_id") REFERENCES "funcoes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
--  As 7 funcoes do BPMN + administrador do sistema
-- ------------------------------------------------------------
INSERT INTO "funcoes" ("id","codigo","nome","descricao","sistema") VALUES
  ('11111111-1111-4111-8111-000000000001','SOLICITANTE',   'Solicitante',    'Abre solicitacoes de compra e valida o material recebido.', true),
  ('11111111-1111-4111-8111-000000000002','GESTOR_OBRA',   'Gestor de obra', 'Acompanha a obra e participa da aprovacao.',                true),
  ('11111111-1111-4111-8111-000000000003','COMPRADOR',     'Comprador',      'Monta cotacoes, negocia e emite pedidos de compra.',        true),
  ('11111111-1111-4111-8111-000000000004','ENGENHEIRO',    'Engenheiro',     'Consultado na especificacao tecnica e na aprovacao.',       true),
  ('11111111-1111-4111-8111-000000000005','FUNDADOR',      'Fundador',       'Aprova compras acima do limite de alcada.',                 true),
  ('11111111-1111-4111-8111-000000000006','ALMOXARIFE',    'Almoxarife',     'Recebe, confere e controla o estoque.',                     true),
  ('11111111-1111-4111-8111-000000000007','FORNECEDOR',    'Fornecedor',     'Responde cotacoes e fornece materiais ou servicos.',        true),
  ('11111111-1111-4111-8111-000000000008','ADMINISTRADOR', 'Administrador',  'Configura o sistema, usuarios e permissoes.',               true)
ON CONFLICT ("id") DO NOTHING;
