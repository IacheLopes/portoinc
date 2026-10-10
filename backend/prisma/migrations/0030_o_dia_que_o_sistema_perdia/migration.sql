-- ============================================================
--  O DIA QUE O SISTEMA PERDIA
--
--  Quando a tela mandava uma data sem hora — "2026-10-17" —, o
--  servidor entendia MEIA-NOITE EM UTC. No horário de Brasília
--  isso é 16/10 às 21h, e era o dia 16 que o sistema mostrava e
--  usava.
--
--  Medido em 10/10/2026, no primeiro convite de cotação enviado
--  pelo WhatsApp: o comprador marcou 17/10 e o fornecedor recebeu
--  "responda até 16/10".
--
--  O código já foi corrigido (ver `servicos/data-br.ts`). Esta
--  migração conserta o que já estava GRAVADO.
--
--  POR QUE SÓ AS LINHAS EM 00:00:00
--
--  Só elas vieram de data sem hora. As que têm hora cheia vieram
--  de outro caminho, já com o instante certo — deslocar essas
--  seria criar o defeito onde ele não existia.
--
--  PRAZO VIRA FIM DO DIA, CALENDÁRIO VIRA COMEÇO
--
--  "Responda até 17/10" dá o dia 17 inteiro: vira 17/10
--  23:59:59.999 no horário de Brasília. Já "obra começou em
--  17/10" é data de calendário, e o começo do dia basta.
--
--  O cálculo passa pelo fuso em vez de somar 3 horas na mão: se
--  o horário de verão voltar, a conta continua certa.
-- ============================================================

-- --- PRAZOS: a pessoa tem o dia inteiro ---------------------

-- "Precisa até" da solicitação. É este prazo que ordena a fila
-- de quem aprova, então um dia a menos mudava a ordem da fila.
UPDATE "solicitacoes"
   SET "data_desejada" =
       ((("data_desejada"::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
         AT TIME ZONE 'UTC') - interval '1 millisecond'
 WHERE "data_desejada" IS NOT NULL
   AND "data_desejada"::time = '00:00:00';

-- Prazo de resposta da cotação.
UPDATE "bids"
   SET "prazo_resposta" =
       ((("prazo_resposta"::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
         AT TIME ZONE 'UTC') - interval '1 millisecond'
 WHERE "prazo_resposta"::time = '00:00:00';

-- O vencimento do LINK do portal. Este não era só texto errado:
-- o link morria às 21h do dia anterior, e o fornecedor perdia de
-- verdade o último dia para responder.
UPDATE "bid_fornecedores"
   SET "expira_em" =
       ((("expira_em"::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
         AT TIME ZONE 'UTC') - interval '1 millisecond'
 WHERE "expira_em"::time = '00:00:00';

-- --- DATAS DE CALENDÁRIO: o dia é o dado --------------------

UPDATE "obras"
   SET "data_inicio" =
       (("data_inicio"::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
         AT TIME ZONE 'UTC')
 WHERE "data_inicio" IS NOT NULL
   AND "data_inicio"::time = '00:00:00';

UPDATE "obras"
   SET "data_previsao_fim" =
       (("data_previsao_fim"::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
         AT TIME ZONE 'UTC')
 WHERE "data_previsao_fim" IS NOT NULL
   AND "data_previsao_fim"::time = '00:00:00';
