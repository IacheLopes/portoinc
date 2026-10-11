-- ============================================================
--  A COTAÇÃO ENVIADA É FINAL — mas só dentro da rodada
--
--  Pedido dele em 10/10/2026, depois de testar o portal com o
--  celular do pai: "após eu responder a cotação, se eu clicar no
--  link novamente eu posso mudar as informações, isso não pode
--  acontecer".
--
--  O PORQUÊ DESTA COLUNA, e não de um simples "travou":
--
--  A última chamada existe para pedir que o fornecedor REVEJA o
--  preço — ela reabre o pacote e manda "toque no cartão para
--  rever". Se a trava olhasse só para "já respondeu", a última
--  chamada mandaria o fornecedor para um link que o recusa, e o
--  recurso morreria no mesmo dia em que foi arrumado.
--
--  Então a trava é POR RODADA: respondeu na rodada 1, travado na
--  rodada 1. Quando o comprador abre a última chamada, o pacote
--  vai para a rodada 2 e o link destrava sozinho, sem ninguém
--  precisar lembrar de destravar nada.
-- ============================================================

ALTER TABLE "bid_fornecedores" ADD COLUMN "rodada_respondida" INTEGER;

--  Quem já respondeu antes desta coluna existir conta como
--  respondido NA RODADA EM QUE O PACOTE ESTÁ. É o que torna a
--  trava verdadeira para o BID-00005, que já tem duas respostas
--  dadas — sem isto, a primeira pessoa a abrir o link ainda
--  conseguiria mudar o preço.
UPDATE "bid_fornecedores" bf
   SET "rodada_respondida" = b."rodada"
  FROM "bids" b
 WHERE b."id" = bf."bid_id"
   AND bf."respondido_em" IS NOT NULL;
