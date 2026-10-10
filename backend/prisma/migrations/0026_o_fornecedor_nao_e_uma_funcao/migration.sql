-- ============================================================
--  O FORNECEDOR NÃO É UMA FUNÇÃO DO SISTEMA
--
--  Ela nasceu na migração 0001 porque o BPMN lista "Fornecedor"
--  na tabela de papéis, ao lado de Solicitante, Comprador e
--  Almoxarife. Mas o papel dele no fluxo é outra coisa: o
--  fornecedor **não entra no sistema**.
--
--  Ele responde cotação pelo PORTAL, por um link com token
--  assinado e prazo de validade — decisão de arquitetura §2.4,
--  "portal do fornecedor: link com token assinado, sem login".
--  Nunca houve conta de fornecedor, e nunca vai haver.
--
--  O resultado era uma função que:
--
--    · nunca foi dada a ninguém (0 usuários);
--    · não tem nenhuma permissão (0 — "não faz nada");
--    · não aparece em faixa de alçada nem em assinatura;
--    · não é citada em uma linha de código.
--
--  Em 10/10/2026, com a tela de Funções e permissões no ar, ela
--  passou a ocupar um cartão inteiro dizendo "Ninguém com esta
--  função · Não faz nada ainda". O dono do sistema pediu para
--  tirar, e tem razão: cadastro que não serve para nada ensina
--  quem usa a ignorar a tela.
--
--  Sai sem deixar buraco, porque nada aponta para ela.
-- ============================================================

DELETE FROM "funcoes_permissoes"
 WHERE "funcao_id" IN (SELECT "id" FROM "funcoes" WHERE "codigo" = 'FORNECEDOR');

DELETE FROM "usuarios_funcoes"
 WHERE "funcao_id" IN (SELECT "id" FROM "funcoes" WHERE "codigo" = 'FORNECEDOR');

DELETE FROM "funcoes" WHERE "codigo" = 'FORNECEDOR';
