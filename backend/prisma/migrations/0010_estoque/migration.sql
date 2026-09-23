-- CreateEnum
CREATE TYPE "TipoMovimento" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE', 'TRANSFERENCIA_SAIDA', 'TRANSFERENCIA_ENTRADA');

-- CreateTable
CREATE TABLE "saldos_estoque" (
    "id" TEXT NOT NULL,
    "almoxarifado_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "custo_medio" DECIMAL(14,4),
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldos_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_estoque" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "almoxarifado_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "TipoMovimento" NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "saldo_depois" DECIMAL(14,4) NOT NULL,
    "valor_unitario" DECIMAL(14,4),
    "recebimento_item_id" TEXT,
    "destino" TEXT,
    "observacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saldos_estoque_material_id_idx" ON "saldos_estoque"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_estoque_almoxarifado_id_material_id_key" ON "saldos_estoque"("almoxarifado_id", "material_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimentos_estoque_numero_key" ON "movimentos_estoque"("numero");

-- CreateIndex
CREATE INDEX "movimentos_estoque_almoxarifado_id_material_id_idx" ON "movimentos_estoque"("almoxarifado_id", "material_id");

-- CreateIndex
CREATE INDEX "movimentos_estoque_criado_em_idx" ON "movimentos_estoque"("criado_em");

-- AddForeignKey
ALTER TABLE "saldos_estoque" ADD CONSTRAINT "saldos_estoque_almoxarifado_id_fkey" FOREIGN KEY ("almoxarifado_id") REFERENCES "almoxarifados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_estoque" ADD CONSTRAINT "saldos_estoque_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_almoxarifado_id_fkey" FOREIGN KEY ("almoxarifado_id") REFERENCES "almoxarifados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_recebimento_item_id_fkey" FOREIGN KEY ("recebimento_item_id") REFERENCES "recebimento_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ------------------------------------------------------------
--  Saldo inicial
--
--  As entregas conferidas antes desta migração já entraram no
--  almoxarifado de verdade — só não tinham onde ser somadas.
--  Aqui elas viram movimento de ENTRADA e formam o primeiro
--  saldo, para o estoque não nascer zerado e mentindo.
-- ------------------------------------------------------------
WITH entradas AS (
  SELECT
    ri."id"                   AS recebimento_item_id,
    r."almoxarifado_id"       AS almoxarifado_id,
    bi."material_id"          AS material_id,
    r."almoxarife_id"         AS usuario_id,
    ri."quantidade_recebida"  AS quantidade,
    pi."valor_unitario"       AS valor_unitario,
    r."recebido_em"           AS recebido_em,
    SUM(ri."quantidade_recebida") OVER (
      PARTITION BY r."almoxarifado_id", bi."material_id"
      ORDER BY r."recebido_em", ri."id"
      ROWS UNBOUNDED PRECEDING
    ) AS saldo_depois
  FROM "recebimento_itens" ri
  JOIN "recebimentos" r   ON r."id"  = ri."recebimento_id"
  JOIN "pedido_itens" pi  ON pi."id" = ri."pedido_item_id"
  JOIN "bid_itens" bi     ON bi."id" = pi."bid_item_id"
  WHERE ri."quantidade_recebida" > 0
)
INSERT INTO "movimentos_estoque" (
  "id", "almoxarifado_id", "material_id", "usuario_id", "tipo",
  "quantidade", "saldo_depois", "valor_unitario", "recebimento_item_id",
  "observacao", "criado_em"
)
SELECT
  gen_random_uuid()::text, almoxarifado_id, material_id, usuario_id, 'ENTRADA',
  quantidade, saldo_depois, valor_unitario, recebimento_item_id,
  'Saldo inicial: entrega conferida antes do controle de estoque.', recebido_em
FROM entradas;

INSERT INTO "saldos_estoque" (
  "id", "almoxarifado_id", "material_id", "quantidade", "custo_medio", "atualizado_em"
)
SELECT
  gen_random_uuid()::text,
  "almoxarifado_id",
  "material_id",
  SUM("quantidade"),
  CASE
    WHEN SUM("quantidade") > 0
      THEN SUM("quantidade" * COALESCE("valor_unitario", 0)) / SUM("quantidade")
    ELSE NULL
  END,
  NOW()
FROM "movimentos_estoque"
WHERE "tipo" = 'ENTRADA'
GROUP BY "almoxarifado_id", "material_id";
