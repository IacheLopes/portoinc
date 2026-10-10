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
  type SituacaoEmail, type EmailAutorizado,
} from '../../servicos/email';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { Campo } from '../../componentes/Campo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';

export function ConfiguracaoEmail() {
  const [situacao, setSituacao] = useState<SituacaoEmail | null>(null);
  const [autorizados, setAutorizados] = useState<EmailAutorizado[]>([]);

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
      const [s, a] = await Promise.all([buscarSituacaoEmail(), listarEmailsAutorizados()]);
      setSituacao(s);
      setAutorizados(a.autorizados);
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

          {/* O QUE FALTA, EM VEZ DE SO "NAO ESTA PRONTO".
              O adaptador de verdade ja esta escrito e funciona —
              diferente do SEFAZ, aqui nao falta codigo. Falta a
              empresa ter dominio e conta no provedor. Dizer isso
              na tela poupa a pergunta "e agora?". */}
          {!podeEnviar && (
            <div className="conexao__tempos">
              <div>
                <dt>1. Domínio da empresa</dt>
                <dd>
                  Um endereço como <code>compras@portoinc.com.br</code>
                  <span className="conexao__motivo">
                    Não dá para mandar de Gmail: o fornecedor recebe como suspeito
                  </span>
                </dd>
              </div>

              <div>
                <dt>2. Conta no provedor</dt>
                <dd>
                  Uma chave de envio
                  <span className="conexao__motivo">
                    Entra no sistema como <code>EMAIL_API_TOKEN</code>
                  </span>
                </dd>
              </div>

              <div>
                <dt>3. Dois registros no DNS</dt>
                <dd>
                  SPF e DKIM
                  <span className="conexao__motivo">
                    Sem eles o e-mail sai e cai no spam — pior do que não enviar
                  </span>
                </dd>
              </div>
            </div>
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
            <button
              type="button"
              className="botao botao--principal"
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
