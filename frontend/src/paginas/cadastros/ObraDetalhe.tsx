// ============================================================
//  Detalhe da obra: orçamento e almoxarifados
//
//  O orçamento pode ser digitado linha a linha ou importado de
//  uma planilha salva em CSV — a empresa já mantém orçamento em
//  planilha, e obrigar a redigitar tudo mataria a adoção.
// ============================================================

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  buscarObra, criarLinha, apagarLinha, importarOrcamento,
  dinheiro, quantidade, ROTULO_SITUACAO, UNIDADES,
  type ObraDetalhe as Detalhe,
} from '../../servicos/cadastros';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao, ErroFormulario } from '../../componentes/Campo';
import { Indicador } from '../../componentes/Indicador';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';

const MODELO_CSV =
  'codigo;descricao;unidade;quantidade;valor_unitario\n' +
  '03.01.001;Cimento Portland;SC;1200;34,00\n' +
  '03.02.001;Areia média;M3;180;130,00';

export function ObraDetalhe() {
  const { id = '' } = useParams();
  const { pode } = useAutenticacao();
  const podeEditar = pode('obras.gerenciar');

  const [obra, setObra] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [painel, setPainel] = useState<'nenhum' | 'linha' | 'importar'>('nenhum');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setObra((await buscarObra(id)).obra);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar a obra.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function removerLinha(linhaId: string, codigo: string) {
    setAviso(null);
    try {
      await apagarLinha(id, linhaId);
      setAviso('Linha ' + codigo + ' removida.');
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao remover.');
    }
  }

  if (carregando && !obra) return <Carregando mensagem="Carregando obra..." />;
  if (erro && !obra) return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  if (!obra) return null;

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo={obra.nome}
          marcadores={
            <Selo tipo={obra.situacao === 'EM_ANDAMENTO' ? 'sucesso' : 'info'}>
              {ROTULO_SITUACAO[obra.situacao]}
            </Selo>
          }
          descricao={
            <>
              {obra.codigo}
            {obra.cliente ? ' · ' + obra.cliente : ''}
            {obra.cidade ? ' · ' + obra.cidade : ''}
            {obra.uf ? '/' + obra.uf : ''}
            </>
          }
        />

        <div className="grade">
          <Indicador
            titulo="Orçamento previsto"
            valor={dinheiro(obra.orcamentoTotal)}
            detalhe={obra.linhas.length + ' linha(s) cadastrada(s)'}
          />
          <Indicador
            titulo="Almoxarifados"
            valor={String(obra.almoxarifados.length)}
            detalhe={obra.almoxarifados.map((a) => a.nome).join(', ')}
          />
          <Indicador
            titulo="Realizado"
            valor="—"
            detalhe="Aparece quando as compras começarem (Etapa 9)"
          />
        </div>
      </section>

      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Orçamento</h2>
          <p className="secao__descricao">
            Cada solicitação de compra será apontada para uma destas linhas. Sem elas,
            não há como saber quanto custou cada parte da obra.
          </p>
        </div>

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <span aria-hidden="true">✓</span> {aviso}
          </p>
        )}

        {podeEditar && (
          <div className="barra-acoes">
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => setPainel((p) => (p === 'linha' ? 'nenhum' : 'linha'))}
              aria-expanded={painel === 'linha'}
            >
              {painel === 'linha' ? 'Cancelar' : '+ Nova linha'}
            </button>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => setPainel((p) => (p === 'importar' ? 'nenhum' : 'importar'))}
              aria-expanded={painel === 'importar'}
            >
              📥 Importar planilha
            </button>
          </div>
        )}

        {painel === 'linha' && (
          <FormularioLinha
            obraId={id}
            aoSalvar={async (codigo) => {
              setPainel('nenhum');
              setAviso('Linha ' + codigo + ' adicionada.');
              await carregar();
            }}
          />
        )}

        {painel === 'importar' && (
          <FormularioImportacao
            obraId={id}
            aoConcluir={async (mensagem) => {
              setPainel('nenhum');
              setAviso(mensagem);
              await carregar();
            }}
          />
        )}

        {obra.linhas.length === 0 ? (
          <Vazio
            titulo="Esta obra ainda não tem orçamento"
            descricao="Adicione linha a linha ou importe a planilha que a empresa já usa."
          />
        ) : (
          <Cartao semEspaco>
            <div className="tabela-area">
              <table className="tabela">
                <caption className="apenas-leitor-tela">
                  Linhas do orçamento da obra {obra.nome}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Un.</th>
                    <th scope="col" className="numero">Qtd. prevista</th>
                    <th scope="col" className="numero">Valor unitário</th>
                    <th scope="col" className="numero">Total previsto</th>
                    {podeEditar && (
                      <th scope="col">
                        <span className="apenas-leitor-tela">Ações</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {obra.linhas.map((l) => (
                    <tr key={l.id}>
                      <th scope="row" className="mono">
                        {l.codigo}
                      </th>
                      <td>{l.descricao}</td>
                      <td className="mono">{l.unidade}</td>
                      <td className="numero">{quantidade(l.quantidadePrevista)}</td>
                      <td className="numero">{dinheiro(l.valorUnitarioPrevisto)}</td>
                      <td className="numero destaque">{dinheiro(l.valorTotalPrevisto)}</td>
                      {podeEditar && (
                        <td>
                          <button
                            type="button"
                            className="botao botao--discreto"
                            onClick={() => void removerLinha(l.id, l.codigo)}
                          >
                            Remover
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={5}>
                      Total previsto da obra
                    </th>
                    <td className="numero destaque">{dinheiro(obra.orcamentoTotal)}</td>
                    {podeEditar && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Cartao>
        )}
      </section>
    </>
  );
}

// ------------------------------------------------------------
//  Nova linha
// ------------------------------------------------------------
function FormularioLinha({
  obraId,
  aoSalvar,
}: {
  obraId: string;
  aoSalvar: (codigo: string) => Promise<void>;
}) {
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [qtd, setQtd] = useState('');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const total = (Number(qtd) || 0) * (Number(valor) || 0);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    try {
      await criarLinha(obraId, {
        codigo,
        descricao,
        unidade,
        quantidadePrevista: Number(qtd) || 0,
        valorUnitarioPrevisto: Number(valor) || 0,
      });
      await aoSalvar(codigo);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível adicionar.');
      }
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <Cartao className="formulario" titulo="Nova linha de orçamento">

        <div className="formulario__linha">
          <Campo rotulo="Código" valor={codigo} aoMudar={setCodigo} exemplo="03.01.001" obrigatorio />
          <Campo
            rotulo="Descrição"
            valor={descricao}
            aoMudar={setDescricao}
            exemplo="Cimento Portland"
            obrigatorio
          />
        </div>

        <div className="formulario__linha">
          <Selecao
            rotulo="Unidade"
            valor={unidade}
            aoMudar={setUnidade}
            opcoes={UNIDADES.map((u) => ({ valor: u, rotulo: u }))}
            obrigatorio
          />
          <Campo rotulo="Quantidade prevista" valor={qtd} aoMudar={setQtd} tipo="number" exemplo="1200" />
          <Campo rotulo="Valor unitário (R$)" valor={valor} aoMudar={setValor} tipo="number" exemplo="34.00" />
        </div>

        {total > 0 && (
          <p className="aviso aviso--info">
            <span aria-hidden="true">=</span>
            <span>
              Total previsto desta linha: <strong>{dinheiro(total)}</strong>
            </span>
          </p>
        )}

        {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

        <div className="formulario__acoes">
          <button
            type="submit"
            className="botao botao--principal"
            disabled={enviando || !codigo || !descricao}
          >
            {enviando ? 'Salvando...' : 'Adicionar linha'}
          </button>
        </div>
      </Cartao>
    </form>
  );
}

// ------------------------------------------------------------
//  Importação de planilha
// ------------------------------------------------------------
function FormularioImportacao({
  obraId,
  aoConcluir,
}: {
  obraId: string;
  aoConcluir: (mensagem: string) => Promise<void>;
}) {
  const [csv, setCsv] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  async function aoEscolherArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const escolhido = evento.target.files?.[0];
    if (!escolhido) return;
    setCsv(await escolhido.text());
    setErro(null);
    setProblemas([]);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setProblemas([]);
    setEnviando(true);

    try {
      const r = await importarOrcamento(obraId, csv);

      const partes = [r.importadas + ' linha(s) importada(s)'];
      if (r.ignoradas > 0) partes.push(r.ignoradas + ' já existiam e foram ignoradas');
      if (r.totalDeProblemas > 0) partes.push(r.totalDeProblemas + ' linha(s) com problema');

      if (r.problemas.length > 0) {
        setProblemas(r.problemas);
        setEnviando(false);
        setErro('Importado com ressalvas: ' + partes.join(', ') + '.');
        return;
      }

      await aoConcluir(partes.join(', ') + '.');
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setProblemas((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível importar.');
      }
      setEnviando(false);
    }
  }

  const linhasDetectadas = csv.split(/\r?\n/).filter((l) => l.trim()).length;

  return (
    <form onSubmit={enviar} noValidate>
      <Cartao className="formulario" titulo="Importar orçamento de planilha">

        <div className="aviso aviso--info">
          <span className="aviso__icone" aria-hidden="true">
            📋
          </span>
          <div>
            <strong>Como preparar o arquivo</strong>
            <p>
              No Excel, use <em>Salvar como → CSV</em>. A primeira linha deve ser o
              cabeçalho, e as colunas nesta ordem:
            </p>
            <pre className="modelo">{MODELO_CSV}</pre>
            <p>
              Aceita vírgula ou ponto e vírgula como separador, e valores no formato
              brasileiro (1.234,56). Linhas já existentes são ignoradas, então reimportar
              não duplica nada.
            </p>
          </div>
        </div>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="arquivo-csv">
            Arquivo CSV
          </label>
          <input
            ref={arquivo}
            id="arquivo-csv"
            type="file"
            accept=".csv,text/csv,text/plain"
            className="campo__entrada"
            onChange={(e) => void aoEscolherArquivo(e)}
          />
          <p className="campo__ajuda">
            Ou cole o conteúdo abaixo, se preferir.
          </p>
        </div>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="conteudo-csv">
            Conteúdo
          </label>
          <textarea
            id="conteudo-csv"
            className="campo__entrada campo__area"
            rows={8}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={MODELO_CSV}
          />
          {linhasDetectadas > 1 && (
            <p className="campo__ajuda">
              {linhasDetectadas - 1} linha(s) de dados detectada(s), além do cabeçalho.
            </p>
          )}
        </div>

        {erro && <ErroFormulario mensagem={erro} detalhes={problemas} />}

        <div className="formulario__acoes">
          <button type="submit" className="botao botao--principal" disabled={enviando || !csv.trim()}>
            {enviando ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </Cartao>
    </form>
  );
}
