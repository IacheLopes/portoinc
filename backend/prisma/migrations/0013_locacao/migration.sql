-- CreateEnum
CREATE TYPE "PeriodoLocacao" AS ENUM ('DIARIA', 'SEMANAL', 'MENSAL');

-- CreateEnum
CREATE TYPE "SituacaoLocacao" AS ENUM ('ATIVA', 'DEVOLVIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "contratos_locacao" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "material_id" TEXT,
    "pedido_item_id" TEXT,
    "descricao" TEXT NOT NULL,
    "identificacao" TEXT,
    "quantidade" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "unidade_medida" TEXT NOT NULL,
    "periodicidade" "PeriodoLocacao" NOT NULL DEFAULT 'DIARIA',
    "valor_periodo" DECIMAL(14,2) NOT NULL,
    "inicio_em" TIMESTAMP(3) NOT NULL,
    "previsao_devolucao" TIMESTAMP(3) NOT NULL,
    "devolvido_em" TIMESTAMP(3),
    "situacao" "SituacaoLocacao" NOT NULL DEFAULT 'ATIVA',
    "observacoes" TEXT,
    "motivo" TEXT,
    "responsavel_id" TEXT NOT NULL,
    "devolvido_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_locacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contratos_locacao_numero_key" ON "contratos_locacao"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_locacao_pedido_item_id_key" ON "contratos_locacao"("pedido_item_id");

-- CreateIndex
CREATE INDEX "contratos_locacao_obra_id_idx" ON "contratos_locacao"("obra_id");

-- CreateIndex
CREATE INDEX "contratos_locacao_fornecedor_id_idx" ON "contratos_locacao"("fornecedor_id");

-- CreateIndex
CREATE INDEX "contratos_locacao_situacao_idx" ON "contratos_locacao"("situacao");

-- CreateIndex
CREATE INDEX "contratos_locacao_previsao_devolucao_idx" ON "contratos_locacao"("previsao_devolucao");

-- AddForeignKey
ALTER TABLE "contratos_locacao" ADD CONSTRAINT "contratos_locacao_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_locacao" ADD CONSTRAINT "contratos_locacao_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_locacao" ADD CONSTRAINT "contratos_locacao_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_locacao" ADD CONSTRAINT "contratos_locacao_pedido_item_id_fkey" FOREIGN KEY ("pedido_item_id") REFERENCES "pedido_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_locacao" ADD CONSTRAINT "contratos_locacao_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_locacao" ADD CONSTRAINT "contratos_locacao_devolvido_por_id_fkey" FOREIGN KEY ("devolvido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
