-- ============================================================
--  O E-MAIL PELA PRÓPRIA CONTA DA EMPRESA
--
--  Até aqui o e-mail tinha um caminho só: Resend, por HTTP. Para
--  ligar, a Porto Inc. teria de publicar registros SPF e DKIM no
--  DNS do domínio dela — tarefa de quem administra o domínio, e o
--  domínio ainda nem existe.
--
--  Com SMTP a empresa usa a CONTA DE E-MAIL QUE JÁ TEM (Gmail
--  corporativo, Microsoft 365): entrega o endereço e uma senha de
--  aplicativo, que uma pessoa gera em cinco minutos, sozinha.
--
--  Decidido em 10/10/2026, no mesmo dia em que o pedido à Porto
--  foi escrito: cada item a mais naquela lista é uma semana a mais
--  de espera.
--
--  A CHAVE É A MESMA GAVETA. `chave_cifrada` guarda o segredo dos
--  dois: no Resend é o token da API, no SMTP é a senha. Um cofre
--  só, uma rotina de cifragem só — duas seriam duas chances de
--  alguém guardar algo em texto puro.
-- ============================================================

ALTER TABLE "configuracao_email"
  ADD COLUMN "provedor"      TEXT NOT NULL DEFAULT 'RESEND',
  ADD COLUMN "smtp_host"     TEXT,
  ADD COLUMN "smtp_porta"    INTEGER,
  ADD COLUMN "smtp_usuario"  TEXT;

--  Quem já estava configurado estava no Resend: é o único que
--  existia. O DEFAULT acima cuida das linhas novas; este UPDATE
--  deixa explícito para quem ler a tabela depois.
UPDATE "configuracao_email" SET "provedor" = 'RESEND' WHERE "provedor" IS NULL;
