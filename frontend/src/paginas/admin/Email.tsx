// ============================================================
//  E-mail: trava de segurança, envio de teste e histórico
//
//  Mesma ordem da tela de WhatsApp, e pelo mesmo motivo:
//
//    1. A TRAVA vem primeiro. Antes de qualquer botão de enviar,
//       a pessoa precisa entender que o e-mail sai de verdade.
//    2. Depois a lista de quem pode receber.
//    3. Só então o envio de teste e o histórico.
//
//  padrao-ignora: sem-titulo — é conteúdo de aba; o <h1> é do
//  invólucro (Avisos.tsx), e dois títulos na mesma tela quebram a
//  hierarquia para quem usa leitor de tela.
//
//  padrao-ignora: sem-cabecalho — é conteúdo de aba; o cabeçalho é do invólucro (Avisos.tsx).
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  buscarSituacaoEmail, listarEmailsAutorizados, autorizarEmail, removerEmailAutorizado,
  enviarEmailDeTeste,
  buscarConfiguracaoDeEmail, ligarEmail, desligarEmail,
  type SituacaoEmail, type EmailAutorizado, type ConfiguracaoDeEmail,
} from '../../servicos/email';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo, Selecao } from '../../componentes/Campo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';

/**
 * Os quatro caminhos, na ordem do que a Porto Inc. consegue usar
 * mais rápido. Gmail primeiro porque é o único que não depende de
 * ninguém além de quem já tem a conta.
 */
const CAMINHOS = [
  { valor: 'GMAIL', rotulo: 'Gmail ou Google Workspace' },
  { valor: 'MICROSOFT', rotulo: 'Microsoft 365 ou Outlook' },
  { valor: 'OUTRO', rotulo: 'Outro servidor de e-mail' },
  { valor: 'RESEND', rotulo: 'Resend (serviço de envio)' },
];

const AJUDA_DO_CAMINHO: Record<string, string> = {
  GMAIL:
    'Usa a conta de e-mail que a empresa já tem. Precisa de uma senha de aplicativo, '
    + 'gerada nas configurações da conta Google.',
  MICROSOFT:
    'Usa a conta que a empresa já tem no 365. Precisa de uma senha de aplicativo, '
    + 'gerada nas configurações de segurança da conta.',
  OUTRO:
    'Para quem tem servidor de e-mail próprio. Peça o endereço e a porta a quem cuida dele.',
  RESEND:
    'Serviço de envio por fora. Aguenta volume maior, mas exige cadastrar o domínio da '
    + 'empresa e publicar registros no DNS — tarefa de quem administra o domínio.',
};

export function ConfiguracaoEmail() {
  const [situacao, setSituacao] = useState<SituacaoEmail | null>(null);
  const [autorizados, setAutorizados] = useState<EmailAutorizado[]>([]);

  const [config, setConfig] = useState<ConfiguracaoDeEmail | null>(null);
  const [remetente, setRemetente] = useState('');
  const [chave, setChave] = useState('');

  //  POR ONDE O E-MAIL SAI.
  //
  //  Até 10/10/2026 havia um caminho só, o Resend, que exige
  //  cadastrar o domínio da empresa e publicar registros no DNS —
  //  tarefa de quem administra o domínio, e o domínio da Porto Inc.
  //  ainda nem existe.
  //
  //  Com Gmail ou 365 a empresa usa a conta que já tem: informa o
  //  endereço e uma senha de aplicativo, que uma pessoa gera em
  //  cinco minutos sozinha.
  const [caminho, setCaminho] = useState('GMAIL');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPorta, setSmtpPorta] = useState('587');

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Cadastro de endereço autorizado.
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [observacao, setObservacao] = useState('');

  // Envio de teste.
  const [paraTeste, setParaTeste] = useState('');
  const [assuntoTeste, setAssuntoTeste] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [s, a, c] = await Promise.all([
        buscarSituacaoEmail(),
        listarEmailsAutorizados(),
        buscarConfiguracaoDeEmail(),
      ]);
      setSituacao(s);
      setAutorizados(a.autorizados);
      setConfig(c);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar a tela de e-mail.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Executa e recarrega, mostrando o que aconteceu.
   *
   * O bloqueio pela lista NÃO é erro: é a trava funcionando. Por
   * isso ele aparece como aviso, não como falha vermelha.
   */
  async function executar(acao: () => Promise<{ mensagem: string }>) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await acao();
      setAviso(r.mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não deu certo.');
    } finally {
      setOcupado(false);
    }
  }

  async function adicionarEndereco() {
    await executar(async () => {
      const r = await autorizarEmail({
        email,
        nome,
        observacao: observacao || undefined,
      });
      setEmail('');
      setNome('');
      setObservacao('');
      return r;
    });
  }

  async function testar() {
    await executar(() =>
      enviarEmailDeTeste({
        para: paraTeste,
        assunto: assuntoTeste || undefined,
      }),
    );
  }

  //  PRONTO QUER DIZER QUE O E-MAIL CHEGA.
  //
  //  `pronto` sozinho so diz "tem remetente configurado" — e com
  //  o adaptador simulado isso e verdade e nada sai. As duas
  //  condicoes juntas sao a unica leitura honesta.
  const podeEnviar = Boolean(situacao?.pronto && !situacao.simulado);

  //  LIGADO quer dizer configurado PELA TELA e ativo. E diferente
  //  de `podeEnviar`, que tambem e verdade quando o `.env` do
  //  servidor ja trazia um provedor — nesse caso nao ha o que
  //  desligar por aqui.
  const ligado = Boolean(config?.configurado && config.ativo);

  async function ligar() {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      //  O CAMINHO VIRA CONFIGURAÇÃO AQUI.
      //
      //  Gmail e 365 têm endereço e porta conhecidos — a pessoa não
      //  precisa saber o que é "servidor de saída" para usar a
      //  própria conta. E o usuário é o próprio e-mail: pedir os
      //  dois seria pedir a mesma coisa duas vezes.
      const servidor =
        caminho === 'GMAIL'
          ? { host: 'smtp.gmail.com', porta: 587 }
          : caminho === 'MICROSOFT'
            ? { host: 'smtp.office365.com', porta: 587 }
            : { host: smtpHost.trim(), porta: Number(smtpPorta) || 587 };

      const r = await ligarEmail({
        provedor: caminho === 'RESEND' ? 'RESEND' : 'SMTP',
        remetente: remetente.trim(),
        chave: chave.trim(),
        ...(caminho === 'RESEND'
          ? {}
          : {
              smtpHost: servidor.host,
              smtpPorta: servidor.porta,
              smtpUsuario: remetente.trim(),
            }),
      });
      setConfig(r.configuracao);
      setAviso(r.mensagem ?? 'E-mail ligado.');
      //  A chave nunca mais aparece: some do campo junto com o
      //  sucesso, para nao ficar em tela aberta na mesa de ninguem.
      setChave('');
      await carregar();
    } catch (e) {
      //  O 502 de "guardei mas a prova nao saiu" chega aqui, e a
      //  mensagem dele e a explicacao do provedor — o que a pessoa
      //  precisa para corrigir.
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível ligar o e-mail.');
      await carregar();
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      const r = await desligarEmail();
      setConfig(r.configuracao);
      setAviso(r.mensagem ?? 'Envio desligado.');
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível desligar.');
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) return <Carregando mensagem="Carregando a configuração de e-mail..." />;
  if (erro && !situacao) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;

  return (
    <>
      {/* ----------------------------------------------------
          O ESTADO DO CANAL, NA MESMA FORMA DO WHATSAPP

          As duas abas fazem o mesmo trabalho e passaram meses com
          desenhos diferentes: uma liderava com o estado em corpo
          grande, a outra com uma caixa de aviso. Quem administra
          troca de aba e tem de reaprender onde olhar.

          A regra e a mesma dos dois lados: UMA tipografia grande,
          e ela responde "da para mandar e-mail agora?". O que
          falta para dar, quando nao da, vem logo abaixo — porque
          "nao esta pronto" sem dizer o que falta e so frustracao.
          ---------------------------------------------------- */}
      <section className="secao">
        <Cartao className={'conexao' + (podeEnviar ? ' conexao--no-ar' : '')}>
          <div className="conexao__topo">
            <div>
              <p className="conexao__estado">
                {podeEnviar ? 'Pronto' : 'Não sai ainda'}
              </p>
              <p className="conexao__numero">
                {podeEnviar
                  ? 'Sai de ' + (situacao?.remetente ?? 'remetente configurado')
                  : 'Os e-mails ficam registrados, sem chegar a ninguém'}
              </p>
            </div>

            <div className="conexao__acoes">
              <button
                type="button"
                className="botao botao--discreto"
                onClick={() => void carregar()}
                disabled={ocupado}
              >
                Atualizar
              </button>
            </div>
          </div>

          {/* LIGAR, AQUI MESMO.
              Até 10/10/2026 esta parte era uma LISTA do que
              faltava, e ligar de verdade exigia abrir um arquivo
              no servidor e reiniciar a API — ou seja, alguém da
              AV2 Tech presente no dia do lançamento.

              O WhatsApp nunca foi assim: conecta pela tela. O
              e-mail é que estava fora do padrão da casa.

              A lista não sumiu: virou a ajuda ao lado de cada
              campo, que é onde ela serve. */}
          {!ligado && (
            <>
              <Selecao
                rotulo="Por onde o e-mail sai"
                valor={caminho}
                aoMudar={setCaminho}
                opcoes={CAMINHOS}
                ajuda={AJUDA_DO_CAMINHO[caminho]}
              />

              <div className="formulario__linha formulario__linha--ligar">
                <Campo
                  rotulo={caminho === 'RESEND' ? 'Remetente' : 'E-mail da empresa'}
                  valor={remetente}
                  aoMudar={setRemetente}
                  tipo="email"
                  exemplo="compras@portoinc.com.br"
                  ajuda={
                    caminho === 'RESEND'
                      ? 'Precisa ser de um domínio cadastrado no provedor.'
                      : 'A conta que vai mandar. É dela que o fornecedor recebe.'
                  }
                  obrigatorio
                />
                <Campo
                  rotulo={caminho === 'RESEND' ? 'Chave do provedor' : 'Senha de aplicativo'}
                  valor={chave}
                  aoMudar={setChave}
                  tipo="password"
                  exemplo={caminho === 'RESEND' ? 're_...' : 'abcd efgh ijkl mnop'}
                  ajuda={
                    caminho === 'RESEND'
                      ? 'Fica guardada cifrada e nunca mais aparece na tela.'
                      : 'NÃO é a senha de entrar no e-mail. É uma senha separada, '
                        + 'gerada nas configurações da conta, que serve só para isto e '
                        + 'pode ser revogada sozinha.'
                  }
                  obrigatorio
                />
              </div>

              {/* Só para quem tem servidor próprio. Gmail e 365 já
                  sabem o endereço e a porta — perguntar seria exigir
                  que a pessoa soubesse algo que o sistema sabe. */}
              {caminho === 'OUTRO' && (
                <div className="formulario__linha">
                  <Campo
                    rotulo="Servidor de saída"
                    valor={smtpHost}
                    aoMudar={setSmtpHost}
                    exemplo="smtp.suaempresa.com.br"
                    obrigatorio
                  />
                  <Campo
                    rotulo="Porta"
                    valor={smtpPorta}
                    aoMudar={setSmtpPorta}
                    modoTeclado="numeric"
                    ajuda="587 na maioria dos servidores. 465 quando a conexão é SSL direta."
                    obrigatorio
                  />
                </div>
              )}
            </>
          )}

          {ligado && (
            <dl className="conexao__tempos">
              <div>
                <dt>Sai de</dt>
                <dd>{config?.remetente}</dd>
              </div>
              <div>
                <dt>Chave</dt>
                <dd>
                  {config?.chaveParcial}
                  <span className="conexao__motivo">
                    Guardada cifrada. Para trocar, desligue e ligue de novo
                  </span>
                </dd>
              </div>
              <div>
                <dt>Última prova</dt>
                <dd>
                  {config?.confirmadoEm ? (
                    <>
                      {dataHoraBr(config.confirmadoEm)}
                      <span className="conexao__motivo">um e-mail de verdade chegou</span>
                    </>
                  ) : (
                    <>
                      Nenhuma
                      <span className="conexao__motivo">
                        a configuração está salva, mas o teste não chegou
                      </span>
                    </>
                  )}
                </dd>
              </div>
            </dl>
          )}

          <div className="formulario__acoes formulario__acoes--fim">
            {ligado ? (
              <button
                type="button"
                className="botao botao--perigo"
                onClick={() => void desligar()}
                disabled={ocupado}
              >
                Desligar o e-mail
              </button>
            ) : (
              <button
                type="button"
                className="botao botao--principal"
                onClick={() => void ligar()}
                disabled={ocupado || !remetente.trim() || !chave.trim()}
              >
                {ocupado ? 'Ligando e provando...' : 'Ligar o e-mail'}
              </button>
            )}
          </div>

          {/* "SALVAR" SERIA MENTIRA GENTIL.
              Chave errada salva em silêncio quebra o envio em
              silêncio, e a empresa descobre quando um fornecedor
              reclama. O botão liga E manda uma prova: só fica
              verde se ela chegar. */}
          {!ligado && (
            <p className="texto-fraco">
              Ao ligar, o sistema manda um e-mail de prova para você. O canal só fica
              verde se ele chegar.
            </p>
          )}

          {situacao?.modoTeste && podeEnviar && (
            <p className="conexao__explicacao">
              Envio restrito: só os endereços da lista abaixo recebem. Qualquer outro é
              barrado antes de sair.
            </p>
          )}

          {aviso && (
            <p className="aviso aviso--sucesso" role="status">
              <Icone nome="certo" /> {aviso}
            </p>
          )}

          {erro && situacao && (
            <p className="aviso aviso--erro" role="alert">
              <Icone nome="alerta" /> {erro}
            </p>
          )}
        </Cartao>
      </section>

      {/* ---------- Lista de autorizados ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Endereços autorizados</h2>
          <p className="secao__descricao">
            Enquanto o envio estiver restrito, só estes endereços recebem e-mail.
          </p>
        </div>

        <Cartao>
          <div className="formulario__linha">
            <Campo
              rotulo="E-mail"
              valor={email}
              aoMudar={setEmail}
              tipo="email"
              exemplo="voce@suaempresa.com.br"
              obrigatorio
              ajuda="Comece pelo seu próprio, para testar com segurança."
            />
            <Campo
              rotulo="De quem é"
              valor={nome}
              aoMudar={setNome}
              exemplo="Meu e-mail"
              obrigatorio
            />
            <Campo rotulo="Observação" valor={observacao} aoMudar={setObservacao} maximo={200} />
          </div>

          <div className="formulario__acoes formulario__acoes--fim">
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => void adicionarEndereco()}
              disabled={ocupado || !email || !nome}
            >
              Liberar e-mail
            </button>
          </div>
        </Cartao>

        {autorizados.length === 0 ? (
          <Vazio
            titulo="Nenhum endereço liberado"
            descricao="Comece liberando o seu próprio e-mail para testar com segurança."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Endereços autorizados a receber</caption>
                <thead>
                  <tr>
                    <th scope="col">E-mail</th>
                    <th scope="col">De quem é</th>
                    <th scope="col">Observação</th>
                    <th scope="col">Liberado por</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {autorizados.map((a) => (
                    <tr key={a.id}>
                      <th scope="row" className="mono">
                        {a.emailMascarado}
                      </th>
                      <td>{a.nome}</td>
                      <td className="celula-texto">{a.observacao ?? '—'}</td>
                      <td className="celula-texto">
                        {a.criadoPor}
                        <small className="linha-extra">{dataHoraBr(a.criadoEm)}</small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="botao botao--discreto"
                          onClick={() => void executar(() => removerEmailAutorizado(a.id))}
                          disabled={ocupado}
                        >
                          Tirar da lista
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}
      </section>

      {/* ---------- Envio de teste ---------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Enviar um e-mail de teste</h2>
          <p className="secao__descricao">
            Serve para conferir a configuração antes de mandar qualquer coisa a fornecedor.
          </p>
        </div>

        <Cartao>
          <div className="formulario__linha">
            <Campo
              rotulo="Para"
              valor={paraTeste}
              aoMudar={setParaTeste}
              tipo="email"
              exemplo="voce@suaempresa.com.br"
              obrigatorio
              semMarcaOpcional
            />
            <Campo
              rotulo="Assunto"
              valor={assuntoTeste}
              aoMudar={setAssuntoTeste}
              exemplo="Porto Inc. — teste de envio"
              ajuda="Em branco, usa o assunto padrão."
            />
          </div>

          <div className="formulario__acoes formulario__acoes--fim">
            {/* SECUNDÁRIO, e isso é decisão.

                A tela tinha DOIS botões azuis ao mesmo tempo —
                "Ligar o e-mail" e "Enviar teste" — e dois convites
                principais não convidam nada: o olho não sabe qual é
                a saída. A régua acusou isso o dia inteiro em
                10/10/2026.

                Qual dos dois fica azul não é gosto: é qual deles
                AVANÇA o trabalho. Ligar o e-mail é o que transforma
                a tela de "não configurado" em "funcionando". Mandar
                um teste confere algo que já está de pé — útil, mas
                não é o passo seguinte de ninguém. */}
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => void testar()}
              disabled={ocupado || !paraTeste}
            >
              {ocupado ? 'Enviando...' : 'Enviar teste'}
            </button>
          </div>
        </Cartao>
      </section>

      {/* ---------- O histórico mudou de casa ----------

          Ele mostrava "O que o sistema tentou enviar", só do
          e-mail. Agora mora na aba "Mensagens enviadas", junto
          com o do WhatsApp: os dois canais levam o MESMO convite
          e o MESMO pedido, e quem pergunta "o BID-00005 saiu?"
          não quer perguntar duas vezes.

          Lá a lista tem filtro de período, de canal, de resultado
          e paginação — que é o que uma prova de envio precisa ter.
          ---------------------------------------------------- */}
    </>
  );
}
