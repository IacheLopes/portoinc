-- CreateEnum
CREATE TYPE "SituacaoBid" AS ENUM ('RASCUNHO', 'ABERTO', 'ENCERRADO', 'CANCELADO');

-- AlterEnum
ALTER TYPE "SituacaoSolicitacao" ADD VALUE 'EM_COTACAO';

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "comprador_id" TEXT NOT NULL,
    "situacao" "SituacaoBid" NOT NULL DEFAULT 'RASCUNHO',
    "prazo_resposta" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aberto_em" TIMESTAMP(3),
    "encerrado_em" TIMESTAMP(3),

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_itens" (
    "id" TEXT NOT NULL,
    "bid_id" TEXT NOT NULL,
    "solicitacao_item_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "unidade_medida" TEXT NOT NULL,
    "observacao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bid_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_fornecedores" (
    "id" TEXT NOT NULL,
    "bid_id" TEXT NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "visualizado_em" TIMESTAMP(3),
    "respondido_em" TIMESTAMP(3),
    "valor_frete" DECIMAL(14,2),
    "outros_custos" DECIMAL(14,2),
    "percentual_entrada" DECIMAL(5,2),
    "quantidade_parcelas" INTEGER,
    "intervalo_parcelas_dias" INTEGER,
    "observacao_fornecedor" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotacao_itens" (
    "id" TEXT NOT NULL,
    "bid_fornecedor_id" TEXT NOT NULL,
    "bid_item_id" TEXT NOT NULL,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "valor_unitario" DECIMAL(14,4),
    "marca" TEXT,
    "modelo" TEXT,
    "prazo_entrega_dias" INTEGER,
    "observacao" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotacao_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bids_numero_key" ON "bids"("numero");

-- CreateIndex
CREATE INDEX "bids_situacao_idx" ON "bids"("situacao");

-- CreateIndex
CREATE UNIQUE INDEX "bid_itens_solicitacao_item_id_key" ON "bid_itens"("solicitacao_item_id");

-- CreateIndex
CREATE INDEX "bid_itens_bid_id_idx" ON "bid_itens"("bid_id");

-- CreateIndex
CREATE UNIQUE INDEX "bid_fornecedores_token_key" ON "bid_fornecedores"("token");

-- CreateIndex
CREATE INDEX "bid_fornecedores_bid_id_idx" ON "bid_fornecedores"("bid_id");

-- CreateIndex
CREATE UNIQUE INDEX "bid_fornecedores_bid_id_fornecedor_id_key" ON "bid_fornecedores"("bid_id", "fornecedor_id");

-- CreateIndex
CREATE INDEX "cotacao_itens_bid_item_id_idx" ON "cotacao_itens"("bid_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "cotacao_itens_bid_fornecedor_id_bid_item_id_key" ON "cotacao_itens"("bid_fornecedor_id", "bid_item_id");

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_itens" ADD CONSTRAINT "bid_itens_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_itens" ADD CONSTRAINT "bid_itens_solicitacao_item_id_fkey" FOREIGN KEY ("solicitacao_item_id") REFERENCES "solicitacoes_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_itens" ADD CONSTRAINT "bid_itens_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_fornecedores" ADD CONSTRAINT "bid_fornecedores_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_fornecedores" ADD CONSTRAINT "bid_fornecedores_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotacao_itens" ADD CONSTRAINT "cotacao_itens_bid_fornecedor_id_fkey" FOREIGN KEY ("bid_fornecedor_id") REFERENCES "bid_fornecedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotacao_itens" ADD CONSTRAINT "cotacao_itens_bid_item_id_fkey" FOREIGN KEY ("bid_item_id") REFERENCES "bid_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
