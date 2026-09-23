-- CreateEnum
CREATE TYPE "SituacaoNotaFiscal" AS ENUM ('LANCADA', 'CONFERIDA', 'COM_DIVERGENCIA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SituacaoConta" AS ENUM ('ABERTA', 'PAGA', 'CANCELADA');

-- AlterTable
ALTER TABLE "recebimentos" ADD COLUMN     "nota_fiscal_id" TEXT;

-- CreateTable
CREATE TABLE "notas_fiscais" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT NOT NULL DEFAULT '1',
    "chave_acesso" TEXT,
    "fornecedor_id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "lancada_por_id" TEXT NOT NULL,
    "emitida_em" TIMESTAMP(3) NOT NULL,
    "valor_total" DECIMAL(14,2) NOT NULL,
    "valor_produtos" DECIMAL(14,2),
    "valor_frete" DECIMAL(14,2),
    "situacao" "SituacaoNotaFiscal" NOT NULL DEFAULT 'LANCADA',
    "divergencias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observacoes" TEXT,
    "do_xml" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_fiscais_itens" (
    "id" TEXT NOT NULL,
    "nota_fiscal_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "codigo" TEXT,
    "descricao" TEXT NOT NULL,
    "gtin" TEXT,
    "unidade" TEXT,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "valor_unitario" DECIMAL(14,4) NOT NULL,
    "valor_total" DECIMAL(14,2) NOT NULL,
    "pedido_item_id" TEXT,

    CONSTRAINT "notas_fiscais_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_pagar" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "nota_fiscal_id" TEXT NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "parcela" INTEGER NOT NULL,
    "total_parcelas" INTEGER NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "situacao" "SituacaoConta" NOT NULL DEFAULT 'ABERTA',
    "pago_em" TIMESTAMP(3),
    "valor_pago" DECIMAL(14,2),
    "forma_pagamento" TEXT,
    "pago_por_id" TEXT,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notas_fiscais_pedido_id_idx" ON "notas_fiscais"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "notas_fiscais_fornecedor_id_numero_serie_key" ON "notas_fiscais"("fornecedor_id", "numero", "serie");

-- CreateIndex
CREATE INDEX "notas_fiscais_itens_nota_fiscal_id_idx" ON "notas_fiscais_itens"("nota_fiscal_id");

-- CreateIndex
CREATE UNIQUE INDEX "contas_pagar_numero_key" ON "contas_pagar"("numero");

-- CreateIndex
CREATE INDEX "contas_pagar_vencimento_idx" ON "contas_pagar"("vencimento");

-- CreateIndex
CREATE INDEX "contas_pagar_situacao_idx" ON "contas_pagar"("situacao");

-- AddForeignKey
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_nota_fiscal_id_fkey" FOREIGN KEY ("nota_fiscal_id") REFERENCES "notas_fiscais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_lancada_por_id_fkey" FOREIGN KEY ("lancada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais_itens" ADD CONSTRAINT "notas_fiscais_itens_nota_fiscal_id_fkey" FOREIGN KEY ("nota_fiscal_id") REFERENCES "notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_nota_fiscal_id_fkey" FOREIGN KEY ("nota_fiscal_id") REFERENCES "notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_pago_por_id_fkey" FOREIGN KEY ("pago_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

