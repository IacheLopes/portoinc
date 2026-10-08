-- A TELA DE STATUS SAI DA VISTA DE TODO MUNDO, MENOS DO DEV
--
-- Ela mostra memória da API, estado do banco e QUAIS INTEGRAÇÕES
-- ESTÃO SIMULADAS. É tela de diagnóstico de quem desenvolve, não
-- de quem usa o sistema: para o cliente, ela só denuncia o que
-- ainda é maquete.
--
-- Até aqui a permissão `sistema.status` morava no ADMINISTRADOR —
-- e o dono do sistema entra como administrador. Tirar dele não
-- bastava: a conta DEV também é administradora, e perderia junto.
--
-- Então a permissão muda de casa. Nasce a função DESENVOLVEDOR,
-- que não pertence ao fluxo de compras da Porto Inc. e por isso
-- não aparece na tela de Usuários: é função de quem mantém o
-- sistema, não de quem trabalha nele.

INSERT INTO "funcoes" ("id","codigo","nome","descricao","sistema")
VALUES (
  gen_random_uuid()::text,
  'DESENVOLVEDOR',
  'Desenvolvedor',
  'Quem mantém o sistema. Enxerga as telas de diagnóstico, que não fazem parte do trabalho do dia a dia.',
  true
)
ON CONFLICT ("codigo") DO NOTHING;

-- A permissão sai do administrador.
DELETE FROM "funcoes_permissoes"
 WHERE "funcao_id"    = (SELECT "id" FROM "funcoes"   WHERE "codigo" = 'ADMINISTRADOR')
   AND "permissao_id" = (SELECT "id" FROM "permissoes" WHERE "codigo" = 'sistema.status');

-- E passa para o desenvolvedor.
INSERT INTO "funcoes_permissoes" ("funcao_id","permissao_id")
SELECT f."id", p."id"
  FROM "funcoes" f, "permissoes" p
 WHERE f."codigo" = 'DESENVOLVEDOR'
   AND p."codigo" = 'sistema.status'
ON CONFLICT DO NOTHING;

-- A conta DEV ganha a função. Se ela não existir nesta instalação
-- — num banco do cliente, por exemplo —, nada acontece: ninguém
-- fica com a tela.
INSERT INTO "usuarios_funcoes" ("usuario_id","funcao_id")
SELECT u."id", f."id"
  FROM "usuarios" u, "funcoes" f
 WHERE u."email" = 'porto@dev.com'
   AND f."codigo" = 'DESENVOLVEDOR'
ON CONFLICT DO NOTHING;
