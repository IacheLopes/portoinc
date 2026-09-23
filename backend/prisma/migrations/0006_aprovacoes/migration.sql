-- CreateEnum
CREATE TYPE "DecisaoAprovacao" AS ENUM ('APROVADA', 'REPROVADA', 'DEVOLVIDA');

-- AlterTable
ALTER TABLE "solicitacoes" ADD COLUMN     "exige_todas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "funcoes_exigidas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "regra_alcada_id" TEXT,
ADD COLUMN     "valor_no_envio" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "aprovacoes" (
    "id" TEXT NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "funcao_id" TEXT NOT NULL,
    "decisao" "DecisaoAprovacao" NOT NULL,
    "observacao" TEXT,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprovacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aprovacoes_solicitacao_id_idx" ON "aprovacoes"("solicitacao_id");

-- CreateIndex
CREATE INDEX "aprovacoes_usuario_id_idx" ON "aprovacoes"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "aprovacoes_solicitacao_id_funcao_id_key" ON "aprovacoes"("solicitacao_id", "funcao_id");

-- AddForeignKey
ALTER TABLE "aprovacoes" ADD CONSTRAINT "aprovacoes_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes" ADD CONSTRAINT "aprovacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes" ADD CONSTRAINT "aprovacoes_funcao_id_fkey" FOREIGN KEY ("funcao_id") REFERENCES "funcoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
