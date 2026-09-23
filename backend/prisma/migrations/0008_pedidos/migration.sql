-- CreateEnum
CREATE TYPE "SituacaoPedido" AS ENUM ('RASCUNHO', 'ENVIADO', 'CONFIRMADO', 'CANCELADO');

-- AlterEnum
ALTER TYPE "SituacaoBid" ADD VALUE 'CONCLUIDO';

-- AlterTable
ALTER TABLE "bid_itens" ADD COLUMN     "cotacao_vencedora_id" TEXT;

-- AlterTable
ALTER TABLE "bids" ADD COLUMN     "rodada" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "bid_id" TEXT NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "comprador_id" TEXT NOT NULL,
    "situacao" "SituacaoPedido" NOT NULL DEFAULT 'RASCUNHO',
    "valor_frete" DECIMAL(14,2),
    "outros_custos" DECIMAL(14,2),
    "percentual_entrada" DECIMAL(5,2),
    "quantidade_parcelas" INTEGER,
    "intervalo_parcelas_dias" INTEGER,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_em" TIMESTAMP(3),
    "confirmado_em" TIMESTAMP(3),

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_itens" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "bid_item_id" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "unidade_medida" TEXT NOT NULL,
    "valor_unitario" DECIMAL(14,4) NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "prazo_entrega_dias" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pedido_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_numero_key" ON "pedidos"("numero");

-- CreateIndex
CREATE INDEX "pedidos_bid_id_idx" ON "pedidos"("bid_id");

-- CreateIndex
CREATE INDEX "pedidos_fornecedor_id_idx" ON "pedidos"("fornecedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_itens_bid_item_id_key" ON "pedido_itens"("bid_item_id");

-- CreateIndex
CREATE INDEX "pedido_itens_pedido_id_idx" ON "pedido_itens"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "bid_itens_cotacao_vencedora_id_key" ON "bid_itens"("cotacao_vencedora_id");

-- AddForeignKey
ALTER TABLE "bid_itens" ADD CONSTRAINT "bid_itens_cotacao_vencedora_id_fkey" FOREIGN KEY ("cotacao_vencedora_id") REFERENCES "cotacao_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_bid_item_id_fkey" FOREIGN KEY ("bid_item_id") REFERENCES "bid_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

