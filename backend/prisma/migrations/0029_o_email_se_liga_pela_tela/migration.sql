-- ============================================================
--  O E-MAIL PASSA A SER LIGADO PELA TELA
--
--  Até aqui, ligar o e-mail era: abrir o `.env` NO SERVIDOR,
--  escrever duas variáveis e reiniciar a API. Ou seja, no dia do
--  lançamento alguém da AV2 Tech precisava estar presente — e a
--  cada troca de chave, de novo.
--
--  O WhatsApp nunca foi assim: ele se conecta pela tela, lendo um
--  QR. O e-mail é que estava fora do padrão da casa.
--
--  LINHA ÚNICA, DE PROPÓSITO
--
--  Não existe "a configuração de e-mail da obra X": é uma só para
--  a empresa inteira. O CHECK amarra o id em 'unico', e o banco
--  passa a garantir o que o código teria de lembrar de garantir.
--
--  A CHAVE NÃO ENTRA EM TEXTO PURO
--
--  `chave_cifrada` guarda AES-256-GCM, com a chave derivada do
--  JWT_SECRET (ver `servicos/segredos.ts`). Quem levar um backup
--  não leva junto o direito de mandar e-mail em nome da empresa.
-- ============================================================

CREATE TABLE "configuracao_email" (
    "id"             TEXT NOT NULL DEFAULT 'unico',
    -- De onde a mensagem sai: compras@portoinc.com.br
    "remetente"      TEXT NOT NULL,
    -- A chave do provedor, cifrada. Nunca volta para a tela.
    "chave_cifrada"  TEXT NOT NULL,
    -- Desligar sem perder a configuração: útil para parar o envio
    -- num incidente e religar depois sem redigitar a chave.
    "ativo"          BOOLEAN NOT NULL DEFAULT true,
    -- Quando o último envio de verdade deu certo. É o que deixa a
    -- tela dizer "funcionando" em vez de só "configurado".
    "confirmado_em"  TIMESTAMP(3),
    "atualizado_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" TEXT,

    CONSTRAINT "configuracao_email_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "configuracao_email_linha_unica" CHECK ("id" = 'unico')
);
