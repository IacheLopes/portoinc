// ============================================================
//  Lista de obras
// ============================================================

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  listarObras, criarObra, ROTULO_SITUACAO, UFS,
  type Obra, type SituacaoObra,
} from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao, ErroFormulario } from '../../componentes/Campo';
import { Selo, type TipoSelo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';

const COR_SITUACAO: Record<SituacaoObra, TipoSelo> = {
  PLANEJAMENTO: 'info',
  EM_ANDAMENTO: 'sucesso',
  PARALISADA: 'atencao',
  CONCLUIDA: 'info',
};

export function Obras() {
  const { pode } = useAutenticacao();
  const podeEditar = pode('obras.gerenciar');

  const [obras, setObras] = useState<Obra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async (termo = '') => {
    setCarregando(true);
    setErro(null);
    try {
      setObras((await listarObras(termo || undefined)).obras);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && obras.length === 0) return <Carregando mensagem="Carregando obras..." />;
  if (erro && obras.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Obras"
          descricao={
            <>
              Cada obra tem o próprio orçamento e o próprio almoxarifado. Toda compra é
            apontada para uma linha do orçamento — é assim que se descobre quanto custou
            cada parte da obra.
            </>
          }
        />

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        <div className="barra-acoes">
          <Campo
            rotulo="Buscar"
            valor={busca}
            aoMudar={setBusca}
            tipo="search"
            exemplo="nome, código ou cliente"
            semMarcaOpcional
            aoConfirmar={() => void carregar(busca)}
          />

          <button type="button" className="botao botao--secundario" onClick={() => void carregar(busca)}>
            Buscar
          </button>

          {podeEditar && (
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
            >
              {aberto ? 'Cancelar' : '+ Nova obra'}
            </button>
          )}
        </div>

        {aberto && (
          <FormularioObra
            aoSalvar={async (nome) => {
              setAberto(false);
              setAviso('Obra "' + nome + '" criada, já com o almoxarifado dela.');
              await carregar();
            }}
          />
        )}
      </section>

      <section className="secao">
        {obras.length === 0 ? (
          <Vazio titulo="Nenhuma obra cadastrada" descricao="Cadastre a primeira obra para começar." />
        ) : (
          <Cartao semEspaco>
            <div className="tabela-area">
              <table className="tabela">
                <caption className="apenas-leitor-tela">Obras da Porto Inc.</caption>
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Obra</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Local</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Orçamento</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {obras.map((o) => (
                    <tr key={o.id}>
                      <th scope="row" className="mono">
                        {o.codigo}
                      </th>
                      <td>{o.nome}</td>
                      <td>{o.cliente ?? '—'}</td>
                      <td>
                        {o.cidade ?? '—'}
                        {o.uf ? ' / ' + o.uf : ''}
                      </td>
                      <td>
                        <Selo tipo={COR_SITUACAO[o.situacao]}>{ROTULO_SITUACAO[o.situacao]}</Selo>
                      </td>
                      <td className="numero">
                        {o.linhas === 0 ? (
                          <Selo tipo="atencao">Sem orçamento</Selo>
                        ) : (
                          o.linhas + ' linhas'
                        )}
                      </td>
                      <td>
                        <Link className="botao botao--discreto botao--link" to={'/cadastros/obras/' + o.id}>
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>
        )}
      </section>
    </>
  );
}

// ------------------------------------------------------------
//  Formulário
// ------------------------------------------------------------
function FormularioObra({ aoSalvar }: { aoSalvar: (nome: string) => Promise<void> }) {
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [cliente, setCliente] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [situacao, setSituacao] = useState<SituacaoObra>('PLANEJAMENTO');
  const [dataInicio, setDataInicio] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      await criarObra({
        codigo,
        nome,
        cliente: cliente || undefined,
        cidade: cidade || undefined,
        uf: uf || undefined,
        situacao,
        dataInicio: dataInicio || undefined,
      });
      await aoSalvar(nome);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível criar a obra.');
      }
      setEnviando(false);
    }
  }

  return (
    <form className="cartao formulario" onSubmit={enviar} noValidate>
      <h2 className="formulario__titulo">Nova obra</h2>

      <div className="formulario__linha">
        <Campo
          rotulo="Código"
          valor={codigo}
          aoMudar={setCodigo}
          exemplo="OB-004"
          ajuda="Identificação curta e única."
          obrigatorio
        />
        <Campo
          rotulo="Nome da obra"
          valor={nome}
          aoMudar={setNome}
          exemplo="Residencial Porto Belo"
          obrigatorio
        />
      </div>

      <div className="formulario__linha">
        <Campo rotulo="Cliente" valor={cliente} aoMudar={setCliente} exemplo="Porto Inc. Incorporações" />
        <Selecao
          rotulo="Situação"
          valor={situacao}
          aoMudar={(v) => setSituacao(v as SituacaoObra)}
          opcoes={Object.entries(ROTULO_SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo }))}
          obrigatorio
        />
      </div>

      <div className="formulario__linha">
        <Campo rotulo="Cidade" valor={cidade} aoMudar={setCidade} exemplo="São Paulo" />
        <Selecao
          rotulo="UF"
          valor={uf}
          aoMudar={setUf}
          opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))}
          vazio="Escolha..."
        />
      </div>

      <Campo rotulo="Data de início" valor={dataInicio} aoMudar={setDataInicio} tipo="date" />

      <div className="aviso aviso--info">
        <span className="aviso__icone" aria-hidden="true">
          💡
        </span>
        <div>
          <strong>O almoxarifado é criado junto.</strong>
          <p>
            Toda obra nasce com o próprio local de estoque. Assim o material de uma obra
            nunca se mistura com o de outra.
          </p>
        </div>
      </div>

      {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

      <div className="formulario__acoes">
        <button
          type="submit"
          className="botao botao--principal"
          disabled={enviando || !codigo || !nome}
        >
          {enviando ? 'Salvando...' : 'Criar obra'}
        </button>
      </div>
    </form>
  );
}
