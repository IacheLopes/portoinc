-- ============================================================
--  A AREA IA
--
--  O cerebro do assistente sai do codigo e vai para a tela: o
--  NOME por que ele atende, as instrucoes que moldam o jeito
--  dele, o modelo e as chaves de ligar.
--
--  E os grupos. O JID de um grupo e um numero enorme que ninguem
--  digita, entao o sistema anota todo grupo de onde chega
--  mensagem e a tela libera com um clique. Comeca TRANCADO: a
--  resposta em grupo alcanca todo mundo do grupo.
-- ============================================================

CREATE TABLE "configuracao_ia" (
  "id"                   TEXT NOT NULL DEFAULT 'unico',
  "nome"                 TEXT NOT NULL DEFAULT 'Porto',
  "instrucoes"           TEXT,
  "provedor"             TEXT NOT NULL DEFAULT 'GROQ',
  "modelo"               TEXT,
  "chave_cifrada"        TEXT,
  "ativo"                BOOLEAN NOT NULL DEFAULT false,
  "responde_sozinho"     BOOLEAN NOT NULL DEFAULT false,
  "responder_no_privado" BOOLEAN NOT NULL DEFAULT true,
  "exigir_nome_em_grupo" BOOLEAN NOT NULL DEFAULT true,
  "transcrever_audio"    BOOLEAN NOT NULL DEFAULT true,
  "limite_por_hora"      INTEGER NOT NULL DEFAULT 12,
  "confirmado_em"        TIMESTAMP(3),
  "atualizado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por"       TEXT,

  CONSTRAINT "configuracao_ia_pkey" PRIMARY KEY ("id"),
  -- Linha unica, como a do e-mail: duas configuracoes de cerebro
  -- seria duas verdades sobre o mesmo assistente.
  CONSTRAINT "configuracao_ia_linha_unica" CHECK ("id" = 'unico')
);

CREATE TABLE "grupos_whatsapp" (
  "id"           TEXT NOT NULL,
  "jid"          TEXT NOT NULL,
  "nome"         TEXT,
  "liberado"     BOOLEAN NOT NULL DEFAULT false,
  "visto_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "liberado_em"  TIMESTAMP(3),
  "liberado_por" TEXT,

  CONSTRAINT "grupos_whatsapp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grupos_whatsapp_jid_key" ON "grupos_whatsapp"("jid");
