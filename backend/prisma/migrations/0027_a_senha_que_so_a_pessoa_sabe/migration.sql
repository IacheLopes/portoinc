-- ============================================================
--  A SENHA QUE SÓ A PESSOA SABE
--
--  Até aqui o administrador digitava uma senha provisória e
--  precisava repassá-la de algum jeito — e durante esse trajeto
--  duas pessoas sabiam a senha de uma conta.
--
--  O convite inverte isso: o sistema sorteia um link, o
--  administrador copia e manda, e quem abre cria a própria senha.
--  O administrador nunca chega a saber qual é.
--
--  Guardamos o RESUMO (SHA-256) do token, nunca ele. É a mesma
--  regra da tabela `sessoes`: quem levar o banco leva hashes, não
--  links que abrem contas.
-- ============================================================

CREATE TABLE "convites_de_senha" (
    "id"         TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em"  TIMESTAMP(3) NOT NULL,
    "usado_em"   TIMESTAMP(3),
    "criado_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" TEXT,

    CONSTRAINT "convites_de_senha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "convites_de_senha_token_hash_key" ON "convites_de_senha"("token_hash");
CREATE INDEX "convites_de_senha_usuario_id_idx" ON "convites_de_senha"("usuario_id");

-- A faxina dos vencidos varre por esta coluna.
CREATE INDEX "convites_de_senha_expira_em_idx" ON "convites_de_senha"("expira_em");

-- Conta apagada leva os convites dela junto: link orfao que ainda
-- respondesse seria um buraco.
ALTER TABLE "convites_de_senha"
  ADD CONSTRAINT "convites_de_senha_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
