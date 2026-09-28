-- A SOLICITAÇÃO NUNCA FECHAVA
--
-- O passo 10 do BPMN da Porto Inc. é "Validação (solicitante) —
-- confere se é o que foi pedido". Ele não existia.
--
-- Consequência medida em 28/09/2026, no banco de desenvolvimento:
-- a SOL-00003 estava "Em cotação" com o pedido dela já RECEBIDO. O
-- material chegou, entrou no estoque, virou nota e virou conta
-- paga — e a tela de quem pediu continuava dizendo "em cotação".
--
-- Isso ataca justamente a queixa numero um de quem usa planilha:
-- "ninguem sabia se chegou". O comprador sabia, o almoxarife
-- sabia, o financeiro sabia. So quem pediu nao sabia.

-- 1. O estado que faltava no fim da vida da solicitação.
ALTER TYPE "SituacaoSolicitacao" ADD VALUE IF NOT EXISTS 'ATENDIDA';

-- 2. A validação do solicitante: quem disse "é isso que eu pedi",
--    e quando. Nulo enquanto ninguém conferiu.
ALTER TABLE "solicitacoes"
  ADD COLUMN IF NOT EXISTS "validada_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "validada_por_id" TEXT;

ALTER TABLE "solicitacoes"
  ADD CONSTRAINT "solicitacoes_validada_por_id_fkey"
  FOREIGN KEY ("validada_por_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. VER a equalização sem poder mexer nela.
--
-- O BPMN diz que a equalização é conferida por comprador,
-- solicitante E engenheiro juntos — é ali que se checa se o que
-- foi cotado atende à especificação. So existia
-- `cotacoes.gerenciar`, que da poder de escolher vencedor e
-- fechar a compra. O engenheiro nao entrava.
INSERT INTO "permissoes" ("id","codigo","nome","grupo") VALUES
  ('22222222-2222-4222-8222-000000000025','cotacoes.ver','Ver cotações e o mapa comparativo','Compras')
ON CONFLICT DO NOTHING;

-- Quem já conduz a cotação também vê.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id" FROM "funcoes" f CROSS JOIN "permissoes" p
WHERE f."codigo" IN ('ADMINISTRADOR','COMPRADOR','ENGENHEIRO','FUNDADOR')
  AND p."codigo" = 'cotacoes.ver'
ON CONFLICT DO NOTHING;
