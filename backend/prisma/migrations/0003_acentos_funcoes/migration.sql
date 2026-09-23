-- ============================================================
--  Migração 0003 - Acentuação das funções
--
--  As descrições da migração 0001 foram gravadas sem acento.
--  Como esse texto aparece na tela para o usuário final, aqui
--  ele é corrigido para português correto.
-- ============================================================

UPDATE "funcoes" SET "descricao" = 'Abre solicitações de compra e valida o material recebido.'
  WHERE "codigo" = 'SOLICITANTE';

UPDATE "funcoes" SET "descricao" = 'Acompanha a obra e participa da aprovação.'
  WHERE "codigo" = 'GESTOR_OBRA';

UPDATE "funcoes" SET "descricao" = 'Monta cotações, negocia e emite pedidos de compra.'
  WHERE "codigo" = 'COMPRADOR';

UPDATE "funcoes" SET "descricao" = 'Consultado na especificação técnica e na aprovação.'
  WHERE "codigo" = 'ENGENHEIRO';

UPDATE "funcoes" SET "descricao" = 'Aprova compras acima do limite de alçada.'
  WHERE "codigo" = 'FUNDADOR';

UPDATE "funcoes" SET "descricao" = 'Recebe, confere e controla o estoque.'
  WHERE "codigo" = 'ALMOXARIFE';

UPDATE "funcoes" SET "descricao" = 'Responde cotações e fornece materiais ou serviços. Acessa por link, sem login.'
  WHERE "codigo" = 'FORNECEDOR';

UPDATE "funcoes" SET "descricao" = 'Configura o sistema, usuários e permissões.'
  WHERE "codigo" = 'ADMINISTRADOR';
