-- AS QUE JÁ TINHAM CHEGADO CONTINUAVAM ABERTAS
--
-- A regra nova só age no próximo recebimento. Sem esta correção, a
-- solicitação cujo material chegou ONTEM ficaria dizendo "em
-- cotação" para sempre — e seria justamente a primeira coisa que
-- alguém da Porto Inc. iria olhar.
--
-- Fecha toda solicitação que está em cotação e cujos itens já
-- chegaram por inteiro. É exatamente a mesma conta que a rota de
-- recebimento faz, escrita em SQL.
--
-- Fica DE FORA a validação do solicitante: ninguém conferiu essas
-- entregas pela tela, e marcar como conferido o que não foi seria
-- inventar uma assinatura. `validada_em` continua nula, e o botão
-- "É o que eu pedi" aparece para quem quiser fechar o ciclo.

UPDATE "solicitacoes" s
SET "situacao" = 'ATENDIDA'
WHERE s."situacao" = 'EM_COTACAO'
  -- Solicitação sem item nenhum não foi atendida: não havia o que
  -- atender.
  AND EXISTS (
    SELECT 1 FROM "solicitacoes_itens" si WHERE si."solicitacao_id" = s."id"
  )
  -- Nenhum item pode estar faltando.
  AND NOT EXISTS (
    SELECT 1
    FROM "solicitacoes_itens" si
    LEFT JOIN "bid_itens" bi ON bi."solicitacao_item_id" = si."id"
    LEFT JOIN "pedido_itens" pi ON pi."bid_item_id" = bi."id"
    LEFT JOIN "pedidos" p ON p."id" = pi."pedido_id" AND p."situacao" <> 'CANCELADO'
    WHERE si."solicitacao_id" = s."id"
      AND (
        -- Item que nunca virou pedido, ou cujo pedido foi cancelado.
        p."id" IS NULL
        -- Ou que chegou pela metade.
        OR COALESCE((
          SELECT SUM(ri."quantidade_recebida")
          FROM "recebimento_itens" ri
          WHERE ri."pedido_item_id" = pi."id"
        ), 0) < pi."quantidade"
      )
  );
