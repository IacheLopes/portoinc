// ============================================================
//  Administração de usuários
//
//  Mostra quem tem acesso, com quais funções, e permite
//  cadastrar gente nova. É aqui que se cumpre o pedido da
//  reunião: "cada usuário pode ter mais de uma função".
// ============================================================

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  listarUsuarios,
  listarFuncoes,
  criarUsuario,
  editarUsuario,
  ErroApi,
  type UsuarioAdmin,
} from '../../servicos/api';
import { Selo } from '../../componentes/Selo';
import { Campo } from '../../componentes/Campo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';

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
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [formAberto, setFormAberto] = useState(false);
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

  useEffect(() => {
    void carregar();
  }, [carregar]);

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
        <div className="secao__cabecalho">
          <h1>Usuários</h1>
          <p className="secao__descricao">
            Cada pessoa pode acumular várias funções. As permissões somam: quem é
            Comprador <em>e</em> Solicitante tem o que as duas funções liberam.
          </p>
        </div>

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

          <button
            type="button"
            className="botao botao--secundario"
            onClick={() => void carregar(busca)}
          >
            Buscar
          </button>

          <button
            type="button"
            className="botao botao--principal"
            onClick={() => setFormAberto((v) => !v)}
            aria-expanded={formAberto}
          >
            {formAberto ? 'Cancelar' : '+ Novo usuário'}
          </button>
        </div>

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        {formAberto && (
          <FormularioUsuario
            funcoes={funcoes}
            aoSalvar={async () => {
              setFormAberto(false);
              setAviso('Usuário cadastrado. Ele criará a própria senha no primeiro acesso.');
              await carregar(busca);
            }}
          />
        )}
      </section>

      <section className="secao">
        {usuarios.length === 0 ? (
          <Vazio
            titulo="Nenhum usuário encontrado"
            descricao="Tente outro termo de busca ou cadastre um novo usuário."
          />
        ) : (
          <div className="cartao cartao--tabela">
            <div className="tabela-area">
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
                      <td>
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
            </div>
          </div>
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
            <article key={f.id} className="cartao">
              <h3 className="cartao__titulo">{f.nome}</h3>
              <p className="funcao__descricao">{f.descricao}</p>
              <p className="cartao__rodape">
                <strong>{f.permissoes.length}</strong> permissões ·{' '}
                <strong>{f.usuarios}</strong> usuário(s)
              </p>
            </article>
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
  funcoes,
  aoSalvar,
}: {
  funcoes: FuncaoItem[];
  aoSalvar: () => Promise<void>;
}) {
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
        telefone: telefone || undefined,
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
    <form className="cartao formulario" onSubmit={enviar} noValidate>
      <h2 className="formulario__titulo">Novo usuário</h2>

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
          <input
            id="novo-telefone"
            className="campo__entrada"
            placeholder="5511999998888"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
          <p className="campo__ajuda">Usado para os avisos por WhatsApp na Etapa 10.</p>
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
          <span aria-hidden="true">⚠</span> {erro}
          {detalhes.length > 0 && (
            <ul className="campo__erro-lista">
              {detalhes.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="formulario__acoes">
        <button
          type="submit"
          className="botao botao--principal"
          disabled={enviando || selecionadas.length === 0}
        >
          {enviando ? 'Salvando...' : 'Cadastrar usuário'}
        </button>
      </div>
    </form>
  );
}
