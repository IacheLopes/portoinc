-- QUEM MEXEU NO DINHEIRO, E QUANDO
--
-- O plano de arquitetura do projeto diz, na tabela de seguranca:
-- "Auditoria: toda aprovacao, alteracao de preco e movimento de
-- estoque e registrado". E lista `LogAuditoria` entre as entidades.
--
-- A solicitacao ganhou a sua trilha (`solicitacoes_eventos`, com o
-- comentario "nunca e apagada — e ela que responde 'quem mandou
-- comprar isso?'"). O dinheiro lancado a mao, nao: era possivel
-- trocar uma entrada de R$ 100.000 por uma saida de R$ 100.000 e o
-- sistema nao guardava nem quem fez nem o que havia antes.
--
-- Um saldo que muda em R$ 200 mil sem deixar rastro e pior do que
-- um saldo errado: o errado alguem percebe.
--
-- MESMA FORMA DA TRILHA DA SOLICITACAO, de proposito. Duas trilhas
-- com desenhos diferentes seriam duas coisas para aprender e dois
-- lugares para divergir.

CREATE TABLE "lancamentos_eventos" (
  "id"            TEXT NOT NULL,
  "lancamento_id" TEXT NOT NULL,
  "usuario_id"    TEXT,
  "tipo"          TEXT NOT NULL,
  "descricao"     TEXT NOT NULL,
  "criado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lancamentos_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lancamentos_eventos_lancamento_id_idx"
  ON "lancamentos_eventos"("lancamento_id");

-- Apagar o lancamento leva a trilha junto. Nao ha rota que apague
-- lancamento — cancelar nao apaga —, mas o banco nao fica dependendo
-- disso para nao deixar linha orfa.
ALTER TABLE "lancamentos_eventos"
  ADD CONSTRAINT "lancamentos_eventos_lancamento_id_fkey"
  FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- O usuario, NAO. Apagar uma pessoa nao pode apagar o que ela fez
-- com o dinheiro da empresa: o evento fica, sem o nome.
ALTER TABLE "lancamentos_eventos"
  ADD CONSTRAINT "lancamentos_eventos_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
