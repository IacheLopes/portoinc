-- ============================================================
--  As faixas padrão deixam o centavo para trás
--
--  Em 25/09/2026 o teto da faixa passou a NÃO entrar nela: "até
--  R$ 2.000,00" cobre até R$ 1.999,99, e R$ 2.000,00 já é da faixa
--  seguinte. Assim duas faixas escritas 0–2000 e 2000–15000 se
--  encaixam sozinhas, como em faixa de imposto de renda.
--
--  As três faixas que a 0004 semeou foram escritas no jeito antigo,
--  com "2.000,01" e "15.000,01" para desviar da sobreposição. Sob a
--  regra nova esse centavo virou um VÃO: uma compra de exatamente
--  R$ 2.000,00 não cairia em faixa nenhuma e ficaria sem aprovador.
--
--  Aqui elas encostam.
--
--  O `WHERE` compara com o valor antigo de propósito: se alguém já
--  ajustou a faixa à mão, a escolha dessa pessoa fica de pé. Mexer
--  em limite de aprovação sem ser pedido é o tipo de coisa que só se
--  descobre quando uma compra trava.
-- ============================================================

UPDATE "regras_alcada"
   SET "valor_minimo" = 2000.00
 WHERE "id" = '33333333-3333-4333-8333-000000000002'
   AND "valor_minimo" = 2000.01;

UPDATE "regras_alcada"
   SET "valor_minimo" = 15000.00
 WHERE "id" = '33333333-3333-4333-8333-000000000003'
   AND "valor_minimo" = 15000.01;
