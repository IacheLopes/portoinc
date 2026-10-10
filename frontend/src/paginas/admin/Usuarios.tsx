// ============================================================
//  Administração de usuários
//
//  Mostra quem tem acesso, com quais funções, e permite
//  cadastrar gente nova. É aqui que se cumpre o pedido da
//  reunião: "cada usuário pode ter mais de uma função".
// ============================================================

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import {
  listarUsuarios,
  listarFuncoes,
  criarUsuario,
  editarUsuario,
  redefinirSenhaDe,
  ErroApi,
  type UsuarioAdmin,
} from '../../servicos/api';
import { Selo } from '../../componentes/Selo';
import { Campo, ErroFormulario } from '../../componentes/Campo';
import { AvisoDeCriacao } from '../../componentes/AvisoDeCriacao';
import { senhaSorteada } from '../../servicos/senhaSorteada';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { dataHoraBr } from '../../servicos/solicitacoes';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';
import { Modal } from '../../componentes/Modal';
import { useEsperarDigitar } from '../../ganchos/esperarDigitar';
import { mascaraTelefone, telefoneParaGuardar } from '../../servicos/mascaras';
import { palavra } from '../../servicos/texto';

interface FuncaoItem {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  usuarios: number;
  permissoes: Array<{ codigo: string; nome: string; grupo: string }>;
}

function formatarData(iso: string | null): string {
  if (!iso) return 'Nunca entrou';
  return dataHoraBr(iso);
}

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  /** De quem estamos redefinindo a senha. `null` = de ninguém. */
  const [redefinindo, setRedefinindo] = useState<UsuarioAdmin | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async (termo = '') => {
    setCarregando(true);
    setErro(null);
    try {
      const [resUsuarios, resFuncoes] = await Promise.all([
        listarUsuarios(termo || undefined),
        listarFuncoes(),
      ]);
      setUsuarios(resUsuarios.usuarios);
      setFuncoes(resFuncoes.funcoes);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // O campo de digitar espera a pessoa parar, para nao buscar a
  // cada tecla.
  const buscaAdiada = useEsperarDigitar(busca);

  useEffect(() => {
    void carregar(buscaAdiada);
  }, [carregar, buscaAdiada]);

  async function alternarAtivo(usuario: UsuarioAdmin) {
    setAviso(null);
    try {
      await editarUsuario(usuario.id, { ativo: !usuario.ativo });
      setAviso(
        usuario.nome + (usuario.ativo ? ' foi desativado.' : ' foi reativado.'),
      );
      await carregar(busca);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao alterar.');
    }
  }

  if (carregando && usuarios.length === 0) {
    return <Carregando mensagem="Carregando usuários..." />;
  }

  if (erro && usuarios.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Usuários"
          descricao={
            <>
              Cada pessoa pode acumular várias funções. As permissões somam: quem é
            Comprador <em>e</em> Solicitante tem o que as duas funções liberam.
            </>
          }
          acoes={
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => setFormAberto(true)}
            >
              + Novo usuário
            </button>
          }
        />

        <div className="barra-acoes">
          <Campo
            rotulo="Buscar"
            valor={busca}
            aoMudar={setBusca}
            tipo="search"
            exemplo="nome ou e-mail"
            semMarcaOpcional
            aoConfirmar={() => void carregar(busca)}
          />
        </div>

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

                <FormularioUsuario
          key={String(formAberto)}
          aberto={formAberto}
          aoFechar={() => setFormAberto(false)}
          funcoes={funcoes}
          aoSalvar={async () => {
            setFormAberto(false);
            // A mensagem dizia "Ele criará a própria senha no primeiro
            // acesso" — e o formulário pede uma senha PROVISÓRIA, que
            // alguém tem de entregar à pessoa. Quem acreditasse na
            // frase não passaria a senha, e a pessoa não entraria.
            setAviso('Usuário cadastrado. Passe a senha provisória para ele — o sistema vai exigir que ele troque no primeiro acesso.');
            await carregar(busca);
          }}
        />

        <ModalRedefinirSenha
          key={redefinindo?.id ?? 'nenhum'}
          usuario={redefinindo}
          aoFechar={() => setRedefinindo(null)}
          aoTrocar={(nome) => {
            setRedefinindo(null);
            setAviso('Senha de ' + nome + ' redefinida. Ela vale até ele entrar e criar a dele.');
          }}
        />
      </section>

      <section className="secao">
        {usuarios.length === 0 ? (
          <Vazio
            titulo="Nenhum usuário encontrado"
            descricao="Tente outro termo de busca ou cadastre um novo usuário."
          />
        ) : (
          <Cartao semEspaco>
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">
                  Lista de usuários com suas funções e situação
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Funções</th>
                    <th scope="col">Último acesso</th>
                    <th scope="col">Situação</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <th scope="row">{u.nome}</th>
                      <td className="mono">{u.email}</td>
                      <td>
                        <span className="etiquetas">
                          {u.funcoes.map((f) => (
                            <span key={f.id} className="etiqueta">
                              {f.nome}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>{formatarData(u.ultimoAcesso)}</td>
                      <td>
                        {u.ativo ? (
                          <Selo tipo="sucesso">Ativo</Selo>
                        ) : (
                          <Selo tipo="erro">Desativado</Selo>
                        )}
                      </td>
                      <td className="celula-acoes">
                        <button
                          type="button"
                          className="botao botao--discreto"
                          onClick={() => setRedefinindo(u)}
                        >
                          Redefinir senha
                        </button>
                        <button
                          type="button"
                          className="botao botao--discreto"
                          onClick={() => void alternarAtivo(u)}
                        >
                          {u.ativo ? 'Desativar' : 'Reativar'}
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

      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Funções e o que cada uma libera</h2>
          <p className="secao__descricao">
            As 8 funções vieram do fluxo enviado pela Porto Inc.
          </p>
        </div>

        <div className="grade">
          {funcoes.map((f) => (
            <Cartao key={f.id} titulo={f.nome}>
              <p className="funcao__descricao">{f.descricao}</p>
              <p className="linha-de-resumo">
                <strong>{f.permissoes.length}</strong>{' '}
                {palavra(f.permissoes.length, 'permissão', 'permissões')} ·{' '}
                <strong>{f.usuarios}</strong>{' '}
                {palavra(f.usuarios, 'usuário', 'usuários')}
              </p>
            </Cartao>
          ))}
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------
//  Formulário de novo usuário
// ------------------------------------------------------------
function FormularioUsuario({
  aberto,
  aoFechar,
  funcoes,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  funcoes: FuncaoItem[];
  aoSalvar: () => Promise<void>;
}) {
  const idForm = useId();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  function alternarFuncao(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      await criarUsuario({
        nome,
        email,
        telefone: telefoneParaGuardar(telefone) || undefined,
        senha,
        funcoes: selecionadas,
      });
      await aoSalvar();
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes(
          (e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)),
        );
      } else {
        setErro('Não foi possível cadastrar.');
      }
      setEnviando(false);
    }
  }

  return (
    /* O botao de enviar mora no RODAPE do modal, fora do <form>, e
       alcanca o formulario pelo atributo `form`: um submit fora do
       formulario continua enviando aquele formulario. */
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo usuário"
      descricao="As funções decidem o que a pessoa enxerga e o que ela pode fazer."
      temAlteracao={Boolean(nome || email || telefone || senha || selecionadas.length > 0)}
      acoes={
        <>
          <button type="button" className="botao botao--discreto" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            form={idForm}
            className="botao botao--principal"
            disabled={enviando || selecionadas.length === 0}
          >
            {enviando ? 'Salvando...' : 'Cadastrar usuário'}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate>

        <div className="formulario__linha">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="novo-nome">
              Nome completo
            </label>
            <input
              id="novo-nome"
              className="campo__entrada"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="novo-email">
              E-mail
            </label>
            <input
              id="novo-email"
              type="email"
              className="campo__entrada"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
        </div>

        <div className="formulario__linha">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="novo-telefone">
              Telefone <span className="campo__opcional">(opcional)</span>
            </label>
            {/* Escapou da máscara porque não usa o componente Campo.
                Era o último telefone cru do sistema. */}
            <input
              id="novo-telefone"
              className="campo__entrada"
              type="tel"
              inputMode="decimal"
              placeholder="(11) 99999-8888"
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
            />
            <p className="campo__ajuda">
              Usado para os avisos por WhatsApp na Etapa 10. O +55 entra sozinho ao salvar.
            </p>
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="nova-senha">
              Senha provisória
            </label>
            <input
              id="nova-senha"
              type="text"
              className="campo__entrada"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              required
            />
            <p className="campo__ajuda">
              Mínimo 8 caracteres, com letra e número. A pessoa troca no primeiro acesso.
            </p>
          </div>
        </div>

        <fieldset className="campo">
          <legend className="campo__rotulo">Funções (pode marcar mais de uma)</legend>
          <div className="opcoes">
            {funcoes.map((f) => (
              <label key={f.id} className="opcao">
                <input
                  type="checkbox"
                  checked={selecionadas.includes(f.id)}
                  onChange={() => alternarFuncao(f.id)}
                />
                <span>{f.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {erro && (
          <div className="campo__erro" role="alert">
            <Icone nome="alerta" /> {erro}
            {detalhes.length > 0 && (
              <ul className="campo__erro-lista">
                {detalhes.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

      </form>
    </Modal>
  );
}

// ------------------------------------------------------------
//  Redefinir a senha de alguém
//
//  Pedido do dono em 27/09/2026: quando alguém esquece a senha, o
//  administrador precisa conseguir devolver o acesso.
//
//  A ideia final dele é um LINK de uso único, para a pessoa definir
//  a própria senha sem ninguém ver. Isso fica para quando o sistema
//  tiver domínio: hoje ele mora em `localhost` e num IP de rede que
//  muda quando o roteador reinicia, e um link desses não abriria no
//  celular de ninguém.
//
//  Enquanto isso, senha sorteada. Funciona em qualquer endereço.
// ------------------------------------------------------------
function ModalRedefinirSenha({
  usuario,
  aoFechar,
  aoTrocar,
}: {
  /** Preenchido = modal aberto para essa pessoa. */
  usuario: UsuarioAdmin | null;
  aoFechar: () => void;
  aoTrocar: (nome: string) => void;
}) {
  // Sorteada uma vez, ao abrir. Sortear a cada desenho da tela faria
  // a senha mudar embaixo de quem já a copiou.
  const [senha] = useState(senhaSorteada);
  const [copiada, setCopiada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!usuario) return;

    setErro(null);
    setEnviando(true);

    try {
      await redefinirSenhaDe(usuario.id, senha);
      aoTrocar(usuario.nome);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível redefinir.');
      setEnviando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiada(true);
    } catch {
      // Sem permissão de área de transferência — o navegador nega em
      // página servida por HTTP. A senha está à vista de qualquer
      // jeito; dá para selecionar e copiar na mão.
      setErro('Não deu para copiar sozinho. Selecione a senha e copie.');
    }
  }

  return (
    <Modal
      aberto={usuario !== null}
      aoFechar={aoFechar}
      titulo={'Redefinir a senha de ' + (usuario?.nome ?? '')}
      descricao="Uma senha nova é sorteada agora. Ela só vale até a pessoa entrar e criar a dela."
      acoes={
        <>
          <button type="button" className="botao botao--discreto" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="botao botao--principal"
            onClick={() => void confirmar()}
            disabled={enviando}
          >
            {enviando ? 'Redefinindo...' : 'Redefinir agora'}
          </button>
        </>
      }
    >
      <AvisoDeCriacao titulo="Isto não tem volta.">
        Ao confirmar, <strong>a senha antiga para de funcionar na hora</strong> e a pessoa é
        desconectada de onde estiver. Copie a senha abaixo <strong>antes</strong> de
        confirmar — ela não aparece de novo.
      </AvisoDeCriacao>

      <div className="campo">
        <span className="campo__rotulo">Senha provisória</span>
        <div className="senha-sorteada">
          <code>{senha}</code>
          <button type="button" className="botao botao--secundario" onClick={() => void copiar()}>
            {copiada ? 'Copiada' : 'Copiar'}
          </button>
        </div>
        <p className="campo__ajuda">
          Mande para <strong>{usuario?.email}</strong> por WhatsApp ou pessoalmente. No
          primeiro acesso o sistema obriga a trocar.
        </p>
      </div>

      {erro && <ErroFormulario mensagem={erro} />}
    </Modal>
  );
}
