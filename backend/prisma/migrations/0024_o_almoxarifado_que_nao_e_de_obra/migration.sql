-- ============================================================
--  O ALMOXARIFADO CENTRAL
--
--  A decisão D3 do plano diz: estoque "por obra, com um
--  'Almoxarifado Central' como mais um local".
--
--  A peça inteira já existia e nunca era ligada:
--
--    · a coluna `obra_id` do almoxarifado é opcional, de
--      propósito, para caber um que não é de obra nenhuma;
--    · a coluna `central` existe desde a migração 0004;
--    · o recebimento já oferece "os desta obra OU os centrais";
--    · o estoque já lista os de obra primeiro e os centrais
--      por último;
--    · a sugestão de reposição já sabe lidar com almoxarifado
--      sem obra.
--
--  Faltava quem criasse o central. Quem criava era o
--  `seed-cadastros.ts`, que NÃO roda em produção — e não há
--  tela de cadastro de almoxarifado: eles nascem junto com a
--  obra, sempre com `central = false`.
--
--  Resultado, descoberto na simulação de entrega de 09/10/2026:
--  a empresa recebe o sistema com um almoxarifado por obra e
--  nenhum lugar para o que não é de obra nenhuma — o depósito da
--  sede, a ferramenta que circula entre canteiros, a sobra de
--  uma obra que acabou.
--
--  Aqui ele nasce com a instalação, do mesmo jeito que as três
--  faixas de alçada nascem na migração 0004.
-- ============================================================

INSERT INTO "almoxarifados" ("id", "obra_id", "codigo", "nome", "central", "ativo", "criado_em")
VALUES (
  '44444444-4444-4444-8444-000000000001',
  NULL,
  'CENTRAL',
  'Almoxarifado Central',
  true,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("codigo") DO NOTHING;
