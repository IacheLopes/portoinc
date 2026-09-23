-- CreateEnum
CREATE TYPE "SituacaoMensagem" AS ENUM ('ENVIADA', 'FALHOU', 'BLOQUEADA');

-- CreateTable
CREATE TABLE "numeros_autorizados" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "observacao" TEXT,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "numeros_autorizados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_whatsapp" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "destino" TEXT,
    "texto" TEXT NOT NULL,
    "tem_anexo" BOOLEAN NOT NULL DEFAULT false,
    "situacao" "SituacaoMensagem" NOT NULL,
    "id_mensagem" TEXT,
    "erro" TEXT,
    "adaptador" TEXT NOT NULL,
    "contexto" TEXT,
    "referencia" TEXT,
    "enviado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "numeros_autorizados_numero_key" ON "numeros_autorizados"("numero");

-- CreateIndex
CREATE INDEX "mensagens_whatsapp_criado_em_idx" ON "mensagens_whatsapp"("criado_em");

-- CreateIndex
CREATE INDEX "mensagens_whatsapp_situacao_idx" ON "mensagens_whatsapp"("situacao");

-- AddForeignKey
ALTER TABLE "numeros_autorizados" ADD CONSTRAINT "numeros_autorizados_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_whatsapp" ADD CONSTRAINT "mensagens_whatsapp_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

