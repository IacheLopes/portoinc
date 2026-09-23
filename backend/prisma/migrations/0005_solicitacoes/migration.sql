-- CreateEnum
CREATE TYPE "SituacaoSolicitacao" AS ENUM ('RASCUNHO', 'AGUARDANDO_APROVACAO', 'EM_REVISAO', 'APROVADA', 'REPROVADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "solicitacoes" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "obra_id" TEXT NOT NULL,
    "solicitante_id" TEXT NOT NULL,
    "situacao" "SituacaoSolicitacao" NOT NULL DEFAULT 'RASCUNHO',
    "justificativa" TEXT,
    "observacoes" TEXT,
    "data_desejada" TIMESTAMP(3),
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada_em" TIMESTAMP(3),
    "decidida_em" TIMESTAMP(3),
    "atualizada_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes_itens" (
    "id" TEXT NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "linha_orcamento_id" TEXT,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "unidade_medida" TEXT NOT NULL,
    "descricao_complementar" TEXT,
    "especificacao_tecnica" TEXT,
    "primeira_compra" BOOLEAN NOT NULL DEFAULT false,
    "valor_estimado" DECIMAL(14,2),
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "solicitacoes_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes_eventos" (
    "id" TEXT NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_numero_key" ON "solicitacoes"("numero");

-- CreateIndex
CREATE INDEX "solicitacoes_obra_id_idx" ON "solicitacoes"("obra_id");

-- CreateIndex
CREATE INDEX "solicitacoes_solicitante_id_idx" ON "solicitacoes"("solicitante_id");

-- CreateIndex
CREATE INDEX "solicitacoes_situacao_idx" ON "solicitacoes"("situacao");

-- CreateIndex
CREATE INDEX "solicitacoes_itens_solicitacao_id_idx" ON "solicitacoes_itens"("solicitacao_id");

-- CreateIndex
CREATE INDEX "solicitacoes_itens_material_id_idx" ON "solicitacoes_itens"("material_id");

-- CreateIndex
CREATE INDEX "solicitacoes_eventos_solicitacao_id_idx" ON "solicitacoes_eventos"("solicitacao_id");

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_itens" ADD CONSTRAINT "solicitacoes_itens_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_itens" ADD CONSTRAINT "solicitacoes_itens_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_itens" ADD CONSTRAINT "solicitacoes_itens_linha_orcamento_id_fkey" FOREIGN KEY ("linha_orcamento_id") REFERENCES "linhas_orcamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_eventos" ADD CONSTRAINT "solicitacoes_eventos_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_eventos" ADD CONSTRAINT "solicitacoes_eventos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
