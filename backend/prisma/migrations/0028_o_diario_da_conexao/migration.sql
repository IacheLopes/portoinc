-- ============================================================
--  O DIÁRIO DA CONEXÃO DO WHATSAPP
--
--  O adaptador já sabia nove estados — inclusive "caiu" e
--  "deslogado". O que ele não tinha era MEMÓRIA: o campo `desde`
--  era sobrescrito a cada mudança, e nada disso sobrevivia a um
--  reinício da API.
--
--  Na prática isso significava que a pergunta mais simples de
--  quem administra — "a que horas caiu?" — não tinha resposta.
--
--  Cada mudança de estado passa a virar uma linha aqui.
--
--  POR QUE NO BANCO, E NÃO NA MEMÓRIA
--
--  A API reinicia a cada atualização do sistema. Histórico em
--  memória se perde exatamente quando ele seria mais útil: logo
--  depois de algo mudar.
--
--  O NÚMERO ENTRA MASCARADO
--
--  Mesma regra do resto do sistema: `5583••••••48`. Um diário de
--  conexão não precisa saber o telefone inteiro de ninguém, e
--  quem lê a tela também não.
-- ============================================================

CREATE TABLE "eventos_whatsapp" (
    "id"               TEXT NOT NULL,
    -- O estado para o qual a conexão foi. Os mesmos nove nomes do
    -- adaptador, guardados como texto de propósito: se amanhã
    -- surgir um décimo, o diário antigo continua legível.
    "estado"           TEXT NOT NULL,
    "detalhe"          TEXT,
    "numero_mascarado" TEXT,
    "quando"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_whatsapp_pkey" PRIMARY KEY ("id")
);

-- A tela lê sempre "os últimos N, do mais novo para o mais velho".
CREATE INDEX "eventos_whatsapp_quando_idx" ON "eventos_whatsapp"("quando" DESC);

-- E pergunta "quando foi a última vez que o estado foi X?".
CREATE INDEX "eventos_whatsapp_estado_quando_idx" ON "eventos_whatsapp"("estado", "quando" DESC);
