-- ============================================================
--  Supervisionar a fila de aprovações
--
--  VER e ASSINAR são coisas diferentes.
--
--  Assinar é autoridade: depende de estar numa faixa de alçada.
--  Ver é suporte: quando alguém relata "minha solicitação sumiu",
--  o administrador precisa poder olhar a fila e conferir — sem
--  poder aprovar uma compra de R$ 22.500 em nome de ninguém.
--
--  Não dava para reaproveitar `solicitacoes.ver_todas`: ela é de
--  CINCO funções (inclusive Gestor de obra e Comprador) e quer
--  dizer "ver a lista dos outros". Usá-la faria todo gestor ver a
--  fila inteira, incluindo as solicitações que ele mesmo abriu —
--  quebrando, na tela, a regra de que ninguém aprova a própria.
-- ============================================================

INSERT INTO "permissoes" ("id","codigo","nome","grupo") VALUES
  ('22222222-2222-4222-8222-000000000026','solicitacoes.supervisionar','Ver a fila de aprovações inteira','Compras')
ON CONFLICT ("codigo") DO NOTHING;

-- Só o Administrador, que é quem dá suporte.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id"
  FROM "funcoes" f, "permissoes" p
 WHERE f."codigo" = 'ADMINISTRADOR'
   AND p."codigo" = 'solicitacoes.supervisionar'
ON CONFLICT DO NOTHING;
