-- CreateEnum
CREATE TYPE "TipoArquivo" AS ENUM ('XML_NFE', 'PDF_NFE', 'OUTRO');

-- CreateTable
CREATE TABLE "emails_autorizados" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "observacao" TEXT,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_autorizados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails_enviados" (
    "id" TEXT NOT NULL,
    "para" TEXT NOT NULL,
    "destino" TEXT,
    "assunto" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "tem_anexo" BOOLEAN NOT NULL DEFAULT false,
    "situacao" "SituacaoMensagem" NOT NULL,
    "id_mensagem" TEXT,
    "erro" TEXT,
    "adaptador" TEXT NOT NULL,
    "contexto" TEXT,
    "referencia" TEXT,
    "enviado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "tipo_mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "tipo" "TipoArquivo" NOT NULL DEFAULT 'OUTRO',
    "caminho" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "nota_fiscal_id" TEXT,
    "enviado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emails_autorizados_email_key" ON "emails_autorizados"("email");

-- CreateIndex
CREATE INDEX "emails_enviados_criado_em_idx" ON "emails_enviados"("criado_em");

-- CreateIndex
CREATE INDEX "emails_enviados_situacao_idx" ON "emails_enviados"("situacao");

-- CreateIndex
CREATE UNIQUE INDEX "arquivos_caminho_key" ON "arquivos"("caminho");

-- CreateIndex
CREATE INDEX "arquivos_nota_fiscal_id_idx" ON "arquivos"("nota_fiscal_id");

-- AddForeignKey
ALTER TABLE "emails_autorizados" ADD CONSTRAINT "emails_autorizados_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails_enviados" ADD CONSTRAINT "emails_enviados_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_nota_fiscal_id_fkey" FOREIGN KEY ("nota_fiscal_id") REFERENCES "notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
