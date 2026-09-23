-- CreateEnum
CREATE TYPE "SituacaoItemRecebido" AS ENUM ('CONFORME', 'COM_RESSALVA', 'DEVOLVIDO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SituacaoPedido" ADD VALUE 'RECEBIDO_PARCIAL';
ALTER TYPE "SituacaoPedido" ADD VALUE 'RECEBIDO';

-- CreateTable
CREATE TABLE "recebimentos" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "almoxarife_id" TEXT NOT NULL,
    "almoxarifado_id" TEXT NOT NULL,
    "nota_fiscal" TEXT,
    "serie_nota_fiscal" TEXT,
    "transportadora" TEXT,
    "observacoes" TEXT,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recebimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recebimento_itens" (
    "id" TEXT NOT NULL,
    "recebimento_id" TEXT NOT NULL,
    "pedido_item_id" TEXT NOT NULL,
    "quantidade_recebida" DECIMAL(14,4) NOT NULL,
    "quantidade_devolvida" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "situacao" "SituacaoItemRecebido" NOT NULL DEFAULT 'CONFORME',
    "motivo" TEXT,

    CONSTRAINT "recebimento_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recebimentos_numero_key" ON "recebimentos"("numero");

-- CreateIndex
CREATE INDEX "recebimentos_pedido_id_idx" ON "recebimentos"("pedido_id");

-- CreateIndex
CREATE INDEX "recebimentos_almoxarifado_id_idx" ON "recebimentos"("almoxarifado_id");

-- CreateIndex
CREATE INDEX "recebimento_itens_recebimento_id_idx" ON "recebimento_itens"("recebimento_id");

-- CreateIndex
CREATE INDEX "recebimento_itens_pedido_item_id_idx" ON "recebimento_itens"("pedido_item_id");

-- AddForeignKey
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_almoxarife_id_fkey" FOREIGN KEY ("almoxarife_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_almoxarifado_id_fkey" FOREIGN KEY ("almoxarifado_id") REFERENCES "almoxarifados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimento_itens" ADD CONSTRAINT "recebimento_itens_recebimento_id_fkey" FOREIGN KEY ("recebimento_id") REFERENCES "recebimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimento_itens" ADD CONSTRAINT "recebimento_itens_pedido_item_id_fkey" FOREIGN KEY ("pedido_item_id") REFERENCES "pedido_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

