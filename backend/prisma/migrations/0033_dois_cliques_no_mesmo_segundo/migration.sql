-- ============================================================
--  DOIS CLIQUES NO MESMO SEGUNDO
--
--  As travas do financeiro eram feitas no CÓDIGO: lê a linha,
--  confere, grava. Entre a conferência e a gravação existe uma
--  fresta, e duas pessoas clicando no mesmo instante passam as
--  duas por ela.
--
--  Onde isso custava dinheiro:
--
--  1. GERAR AS PARCELAS DA MESMA NOTA. A rota confere se já
--     existem títulos e, se não, cria. Dois cliques simultâneos
--     criam DOIS conjuntos: a dívida dobra. Uma nota de R$ 10.000
--     vira R$ 20.000 a pagar, e ninguém percebe até o fornecedor
--     receber duas vezes — ou até a conciliação não fechar.
--
--  2. DAR BAIXA NA MESMA PARCELA. Resolvido no código, com
--     atualização condicional (ver `rotas/fiscal.ts`): o UPDATE só
--     acontece se a linha ainda estiver como foi lida. Lá não cabe
--     trava de banco, porque o estado válido depende do que foi
--     lido, não de um valor fixo.
--
--  Esta migração resolve o caso 1. Trava de banco não tem fresta:
--  a segunda gravação é recusada pelo Postgres, sempre, mesmo que
--  as duas cheguem no mesmo milissegundo.
-- ============================================================

CREATE UNIQUE INDEX "contas_pagar_nota_parcela"
    ON "contas_pagar" ("nota_fiscal_id", "parcela");
