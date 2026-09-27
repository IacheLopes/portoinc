-- ============================================================
--  Nota cancelada solta o número dela
--
--  O dono do sistema lançou a nota 123456 com R$ 3.200 em vez de
--  R$ 3.000, cancelou para corrigir, e descobriu que não dava para
--  fazer mais nada: relançar o número era recusado, editar não
--  existia, e apagar nota fiscal ninguém apaga.
--
--  O número tinha morrido por causa de um erro de digitação.
--
--  --- por que a unicidade tem de ignorar as canceladas ---
--
--  Cancelar serve para duas situações que o sistema não consegue
--  distinguir:
--
--    1. A nota foi cancelada NA SEFAZ. O número morreu no mundo
--       real e ninguém vai reusá-lo.
--    2. Alguém digitou errado AQUI. A nota continua existindo, o
--       fornecedor continua cobrando por ela, e ela precisa entrar
--       no sistema com o valor certo.
--
--  O segundo caso é o comum de longe. Bloquear para sempre
--  transforma o engano mais banal num beco sem saída.
--
--  --- o índice continua existindo, e continua protegendo ---
--
--  Duas notas VIVAS com o mesmo número e série, do mesmo
--  fornecedor, continuam proibidas — que é a regra fiscal de
--  verdade. O índice só passa a não contar as canceladas.
--
--  Índice parcial é coisa que o Prisma não sabe escrever, então
--  ele vive aqui, escrito à mão. No schema ficou um índice comum,
--  de busca, com a explicação ao lado.
-- ============================================================

DROP INDEX IF EXISTS "notas_fiscais_fornecedor_id_numero_serie_key";

-- A unicidade de verdade: vale só entre as notas que estão de pé.
CREATE UNIQUE INDEX "notas_fiscais_numero_vivo_key"
  ON "notas_fiscais" ("fornecedor_id", "numero", "serie")
  WHERE "situacao" <> 'CANCELADA';

-- Busca por número continua rápida, inclusive nas canceladas.
CREATE INDEX IF NOT EXISTS "notas_fiscais_fornecedor_id_numero_serie_idx"
  ON "notas_fiscais" ("fornecedor_id", "numero", "serie");
