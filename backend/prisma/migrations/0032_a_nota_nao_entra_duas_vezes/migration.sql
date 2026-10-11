-- ============================================================
--  A NOTA NÃO ENTRA DUAS VEZES — nem sob importação em lote
--
--  A conferência de nota repetida já existia, e nasceu de um caso
--  real: em 27/09/2026 o dono lançou R$ 3.200 em vez de R$ 3.000 e
--  cancelou para corrigir.
--
--  Só que ela é feita no código — lê, depois grava — e no banco só
--  havia ÍNDICE, não restrição. Com uma pessoa digitando, funciona.
--  Com o SEFAZ importando várias notas de uma vez, duas passam pela
--  brecha entre a leitura e a gravação. Trava no banco não tem
--  brecha: o banco recusa a segunda, sempre.
--
--  POR QUE PARCIAL, e não única simples:
--
--  Cancelar e relançar corrigido é o caminho de conserto que a
--  própria tela oferece. Uma restrição única comum impediria isso —
--  a nota cancelada continuaria ocupando o número. Por isso as duas
--  travas ignoram as canceladas.
--
--  A CHAVE DE ACESSO ganha trava própria: são os 44 dígitos que
--  identificam a nota no país inteiro, e até aqui ela entrava
--  repetida sem ninguém reclamar. É a identidade natural do
--  documento, e com o SEFAZ é por ela que a nota chega.
-- ============================================================

CREATE UNIQUE INDEX "notas_fiscais_fornecedor_numero_serie_vivas"
    ON "notas_fiscais" ("fornecedor_id", "numero", "serie")
 WHERE "situacao" <> 'CANCELADA';

CREATE UNIQUE INDEX "notas_fiscais_chave_acesso_vivas"
    ON "notas_fiscais" ("chave_acesso")
 WHERE "chave_acesso" IS NOT NULL AND "situacao" <> 'CANCELADA';
