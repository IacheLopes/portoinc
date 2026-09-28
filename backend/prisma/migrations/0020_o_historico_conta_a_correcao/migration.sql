-- O HISTÓRICO TEM DE CONTAR TAMBÉM A CORREÇÃO
--
-- A migração anterior fechou as solicitações cujo material já
-- tinha chegado. Elas passaram a dizer "Atendida" sem que o
-- histórico explicasse quando nem por quê — e histórico que pula
-- um pedaço é pior do que histórico curto: quem lê fica sem saber
-- se confia no resto.
--
-- Daqui para a frente todo recebimento escreve o seu evento. Esta
-- linha é só para as que já existiam.
--
-- `usuario_id` fica nulo de propósito: não foi pessoa nenhuma que
-- fez isso, foi o sistema se corrigindo. Assinar com o nome de
-- alguém seria inventar autor.

INSERT INTO "solicitacoes_eventos" ("id","solicitacao_id","usuario_id","tipo","descricao","criado_em")
SELECT
  gen_random_uuid()::text,
  s."id",
  NULL,
  'ATENDIDA',
  'Situação corrigida pelo sistema: o material desta solicitação já havia chegado por inteiro, mas ela continuava marcada como em cotação.',
  NOW()
FROM "solicitacoes" s
WHERE s."situacao" = 'ATENDIDA'
  AND NOT EXISTS (
    SELECT 1 FROM "solicitacoes_eventos" e
    WHERE e."solicitacao_id" = s."id" AND e."tipo" = 'ATENDIDA'
  );
