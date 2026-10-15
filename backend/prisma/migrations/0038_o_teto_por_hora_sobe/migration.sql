-- ============================================================
--  O TETO DE MENSAGENS POR HORA SOBE DE 12 PARA 30
--
--  Doze foi chute conservador, feito antes de existir uso real. No
--  primeiro teste em grupo de verdade, uma pessoa so bateu o teto
--  em sete minutos de conversa — e o assistente emudeceu sem
--  explicar, o que e pior do que nao ter limite nenhum.
--
--  O limite existe para travar robo em laco, nao para racionar um
--  dia de trabalho. Trinta por pessoa por hora continua cortando
--  disparo automatico, que vem as centenas.
-- ============================================================

ALTER TABLE "configuracao_ia" ALTER COLUMN "limite_por_hora" SET DEFAULT 30;

UPDATE "configuracao_ia" SET "limite_por_hora" = 30 WHERE "limite_por_hora" = 12;
