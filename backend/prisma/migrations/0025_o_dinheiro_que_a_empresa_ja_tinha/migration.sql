-- ============================================================
--  O DINHEIRO QUE A EMPRESA JÁ TINHA
--
--  A Porto Inc. não começa do zero: ela chega com dinheiro em
--  caixa no dia em que sai da planilha. O financeiro conhecia
--  dois tipos — RECEITA e DESPESA —, e o único caminho era
--  lançar o saldo como receita.
--
--  Funciona na conta e mente na leitura: o cartão passa a dizer
--  "Entrou R$ 2.000.000,00" para um dinheiro que a empresa NÃO
--  faturou, e a rosca "de onde vem o dinheiro" marca
--  "Saldo inicial — 100%". Medido na simulação de entrega de
--  09/10/2026, com R$ 2 milhões de verdade dentro.
--
--  POR QUE UMA MARCA, E NÃO UM TERCEIRO TIPO
--
--  A proposta original era um `SALDO_INICIAL` ao lado de RECEITA
--  e DESPESA. Sete lugares do `caixa.ts` perguntam
--  `tipo === 'RECEITA'` para somar: saldo, a receber, o gráfico
--  mensal, o calendário semanal. Com um tipo novo, cada um que
--  eu esquecesse faria o dinheiro DESAPARECER da conta.
--
--  A marca falha para o lado seguro. O saldo inicial continua
--  sendo uma entrada — porque é uma entrada —, todas as somas
--  seguem certas sem tocar em nada, e só as leituras que falam
--  de FATURAMENTO passam a descontá-lo. Esquecer uma dessas
--  mostra o comportamento de hoje, não um buraco.
-- ============================================================

ALTER TABLE "lancamentos_financeiros"
  ADD COLUMN "abertura_de_caixa" BOOLEAN NOT NULL DEFAULT false;

-- Só entrada pode ser abertura de caixa: "saldo inicial negativo"
-- é dívida, e dívida tem o lugar dela.
ALTER TABLE "lancamentos_financeiros"
  ADD CONSTRAINT "abertura_de_caixa_e_sempre_entrada"
  CHECK ("abertura_de_caixa" = false OR "tipo" = 'RECEITA');
