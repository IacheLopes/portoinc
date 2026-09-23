-- CreateEnum
CREATE TYPE "SituacaoObra" AS ENUM ('PLANEJAMENTO', 'EM_ANDAMENTO', 'PARALISADA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "TipoItem" AS ENUM ('MATERIAL', 'SERVICO');

-- CreateTable
CREATE TABLE "obras" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cliente" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "uf" CHAR(2),
    "situacao" "SituacaoObra" NOT NULL DEFAULT 'PLANEJAMENTO',
    "data_inicio" TIMESTAMP(3),
    "data_previsao_fim" TIMESTAMP(3),
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linhas_orcamento" (
    "id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "quantidade_prevista" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "valor_unitario_previsto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linhas_orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almoxarifados" (
    "id" TEXT NOT NULL,
    "obra_id" TEXT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "central" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "almoxarifados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "familias_material" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "familias_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiais" (
    "id" TEXT NOT NULL,
    "familia_id" TEXT NOT NULL,
    "codigo_interno" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoItem" NOT NULL DEFAULT 'MATERIAL',
    "marca" TEXT,
    "gtin" TEXT,
    "norma_tecnica" TEXT,
    "unidade_medida" TEXT NOT NULL,
    "ponto_pedido" DECIMAL(14,4),
    "codigo_linha_padrao" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "inscricao_estadual" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "cidade" TEXT,
    "uf" CHAR(2),
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores_familias" (
    "fornecedor_id" TEXT NOT NULL,
    "familia_id" TEXT NOT NULL,

    CONSTRAINT "fornecedores_familias_pkey" PRIMARY KEY ("fornecedor_id","familia_id")
);

-- CreateTable
CREATE TABLE "contatos_fornecedor" (
    "id" TEXT NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contatos_fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_alcada" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_minimo" DECIMAL(14,2) NOT NULL,
    "valor_maximo" DECIMAL(14,2),
    "exige_todas" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regras_alcada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_alcada_funcoes" (
    "regra_id" TEXT NOT NULL,
    "funcao_id" TEXT NOT NULL,

    CONSTRAINT "regras_alcada_funcoes_pkey" PRIMARY KEY ("regra_id","funcao_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "obras_codigo_key" ON "obras"("codigo");

-- CreateIndex
CREATE INDEX "obras_ativa_idx" ON "obras"("ativa");

-- CreateIndex
CREATE INDEX "linhas_orcamento_obra_id_idx" ON "linhas_orcamento"("obra_id");

-- CreateIndex
CREATE UNIQUE INDEX "linhas_orcamento_obra_id_codigo_key" ON "linhas_orcamento"("obra_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "almoxarifados_codigo_key" ON "almoxarifados"("codigo");

-- CreateIndex
CREATE INDEX "almoxarifados_obra_id_idx" ON "almoxarifados"("obra_id");

-- CreateIndex
CREATE UNIQUE INDEX "familias_material_codigo_key" ON "familias_material"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "materiais_codigo_interno_key" ON "materiais"("codigo_interno");

-- CreateIndex
CREATE UNIQUE INDEX "materiais_gtin_key" ON "materiais"("gtin");

-- CreateIndex
CREATE INDEX "materiais_familia_id_idx" ON "materiais"("familia_id");

-- CreateIndex
CREATE INDEX "materiais_ativo_idx" ON "materiais"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_cnpj_key" ON "fornecedores"("cnpj");

-- CreateIndex
CREATE INDEX "fornecedores_ativo_idx" ON "fornecedores"("ativo");

-- CreateIndex
CREATE INDEX "contatos_fornecedor_fornecedor_id_idx" ON "contatos_fornecedor"("fornecedor_id");

-- AddForeignKey
ALTER TABLE "linhas_orcamento" ADD CONSTRAINT "linhas_orcamento_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "almoxarifados" ADD CONSTRAINT "almoxarifados_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiais" ADD CONSTRAINT "materiais_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "familias_material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedores_familias" ADD CONSTRAINT "fornecedores_familias_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedores_familias" ADD CONSTRAINT "fornecedores_familias_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "familias_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos_fornecedor" ADD CONSTRAINT "contatos_fornecedor_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_alcada_funcoes" ADD CONSTRAINT "regras_alcada_funcoes_regra_id_fkey" FOREIGN KEY ("regra_id") REFERENCES "regras_alcada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_alcada_funcoes" ADD CONSTRAINT "regras_alcada_funcoes_funcao_id_fkey" FOREIGN KEY ("funcao_id") REFERENCES "funcoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
--  Faixas de alçada padrão (decisão D1 do plano)
--
--  Estes valores são um PONTO DE PARTIDA. A Porto Inc. ajusta
--  pela tela de Cadastros > Limites de alçada, sem programador.
-- ============================================================

INSERT INTO "regras_alcada" ("id","descricao","valor_minimo","valor_maximo","exige_todas","ordem","ativa") VALUES
  ('33333333-3333-4333-8333-000000000001','Compras de rotina',        0.00,      2000.00, false, 1, true),
  ('33333333-3333-4333-8333-000000000002','Compras de valor médio',   2000.01,  15000.00, true,  2, true),
  ('33333333-3333-4333-8333-000000000003','Compras de valor elevado',15000.01,      NULL, false, 3, true)
ON CONFLICT ("id") DO NOTHING;

-- Até R$ 2.000: o gestor de obra resolve sozinho.
INSERT INTO "regras_alcada_funcoes" ("regra_id","funcao_id")
SELECT '33333333-3333-4333-8333-000000000001', f."id" FROM "funcoes" f
WHERE f."codigo" = 'GESTOR_OBRA'
ON CONFLICT DO NOTHING;

-- De R$ 2.000 a R$ 15.000: precisa das DUAS assinaturas.
INSERT INTO "regras_alcada_funcoes" ("regra_id","funcao_id")
SELECT '33333333-3333-4333-8333-000000000002', f."id" FROM "funcoes" f
WHERE f."codigo" IN ('GESTOR_OBRA','ENGENHEIRO')
ON CONFLICT DO NOTHING;

-- Acima de R$ 15.000: o fundador precisa assinar.
INSERT INTO "regras_alcada_funcoes" ("regra_id","funcao_id")
SELECT '33333333-3333-4333-8333-000000000003', f."id" FROM "funcoes" f
WHERE f."codigo" = 'FUNDADOR'
ON CONFLICT DO NOTHING;
