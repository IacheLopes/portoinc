-- O FINANCEIRO SÓ SABIA TIRAR
--
-- A nota do fornecedor virava parcela em `contas_pagar`, e pronto.
-- Não havia de onde descontar: o sistema controlava a saída de um
-- caixa que nunca tinha recebido nada.
--
-- Emerson, na reunião de 08/10/2026: "como é que tu fez um
-- financeiro que eu não consigo cadastrar receita e despesa? Ele
-- vai descontar de uma conta que não tem cadastro de dinheiro de
-- entrada". E a regra que ficou para a casa: todo financeiro da
-- AV2 tem cadastro de receita e de despesa.
--
-- ESTA TABELA NÃO SUBSTITUI `contas_pagar`, de propósito. A compra
-- continua nascendo da nota, com fornecedor, pedido e conferência
-- atrás dela. Repetir isso aqui criaria dois lugares para a mesma
-- dívida, e um dia eles divergiriam.
--
-- Aqui mora o que NÃO vem de compra:
--   RECEITA  - medição paga pelo cliente, aporte do sócio, venda de sobra
--   DESPESA  - combustível, aluguel de container, diária de máquina, alvará

CREATE TYPE "TipoLancamento" AS ENUM ('RECEITA', 'DESPESA');

CREATE TYPE "SituacaoLancamento" AS ENUM ('PREVISTO', 'REALIZADO', 'CANCELADO');

CREATE TABLE "lancamentos_financeiros" (
    "id"               TEXT NOT NULL,
    "numero"           SERIAL NOT NULL,
    "tipo"             "TipoLancamento" NOT NULL,
    "descricao"        TEXT NOT NULL,
    "valor"            DECIMAL(14,2) NOT NULL,

    -- Quando é para acontecer. É o irmão do `vencimento` da conta a
    -- pagar: um é a promessa de sair, outro a de entrar.
    "previsto_para"    TIMESTAMP(3) NOT NULL,

    -- Quando aconteceu de verdade. Nulo = ainda não.
    "realizado_em"     TIMESTAMP(3),

    "situacao"         "SituacaoLancamento" NOT NULL DEFAULT 'PREVISTO',

    -- NULO de propósito: a construtora tem dinheiro que é de uma
    -- obra (a medição que o cliente pagou) e dinheiro que é da
    -- empresa (o aporte do sócio). Obrigar a escolher uma obra faria
    -- inventarem uma, e aí o custo por obra passaria a mentir.
    "obra_id"          TEXT,

    -- Texto livre, e não lista fixa. Ninguém aqui sabe hoje todas as
    -- linhas de custo de uma construtora, e lista fixa errada vira
    -- "Outros" com metade do dinheiro dentro.
    "categoria"        TEXT,

    "forma_pagamento"  TEXT,
    "observacoes"      TEXT,

    "criado_por_id"    TEXT NOT NULL,
    "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_financeiros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lancamentos_financeiros_numero_key" ON "lancamentos_financeiros"("numero");
CREATE INDEX "lancamentos_financeiros_tipo_idx"           ON "lancamentos_financeiros"("tipo");
CREATE INDEX "lancamentos_financeiros_situacao_idx"       ON "lancamentos_financeiros"("situacao");
CREATE INDEX "lancamentos_financeiros_previsto_para_idx"  ON "lancamentos_financeiros"("previsto_para");
CREATE INDEX "lancamentos_financeiros_obra_id_idx"        ON "lancamentos_financeiros"("obra_id");

ALTER TABLE "lancamentos_financeiros"
  ADD CONSTRAINT "lancamentos_financeiros_obra_id_fkey"
  FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lancamentos_financeiros"
  ADD CONSTRAINT "lancamentos_financeiros_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
