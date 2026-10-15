-- ============================================================
--  O SISTEMA PASSA A OUVIR
--
--  Ate aqui `mensagens_whatsapp` so guardava o que SAIU: nao
--  havia coluna de direcao porque nao havia outra direcao. O
--  assistente muda isso.
--
--  Tudo que ja existe vira SAIDA, que e o que de fato era.
-- ============================================================

CREATE TYPE "DirecaoMensagem" AS ENUM ('ENTRADA', 'SAIDA');

ALTER TYPE "SituacaoMensagem" ADD VALUE IF NOT EXISTS 'RASCUNHO';
ALTER TYPE "SituacaoMensagem" ADD VALUE IF NOT EXISTS 'RECEBIDA';

ALTER TABLE "mensagens_whatsapp"
  ADD COLUMN "direcao" "DirecaoMensagem" NOT NULL DEFAULT 'SAIDA',
  ADD COLUMN "responde_a_id" TEXT,
  ADD COLUMN "modelo_ia" TEXT,
  ADD COLUMN "consultas_ia" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "tokens_ia" INTEGER,
  ADD COLUMN "aprovado_por_id" TEXT;

ALTER TABLE "mensagens_whatsapp"
  ADD CONSTRAINT "mensagens_whatsapp_responde_a_id_fkey"
  FOREIGN KEY ("responde_a_id") REFERENCES "mensagens_whatsapp"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mensagens_whatsapp"
  ADD CONSTRAINT "mensagens_whatsapp_aprovado_por_id_fkey"
  FOREIGN KEY ("aprovado_por_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- A conversa de um numero, em ordem. E a consulta que a tela do
-- assistente faz o tempo todo.
CREATE INDEX "mensagens_whatsapp_numero_criado_em_idx"
  ON "mensagens_whatsapp"("numero", "criado_em");
