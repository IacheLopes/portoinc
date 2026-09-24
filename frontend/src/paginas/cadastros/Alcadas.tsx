// ============================================================
//  Limites de alçada
//
//  O BPMN da Porto Inc. deixou o limite escrito como "A definir".
//  Por isso ele virou configuração de tela: a empresa ajusta
//  quando quiser, sem depender de programador.
//
//  O simulador é o coração da tela: em vez de tentar entender
//  as faixas lendo tabela, a pessoa digita um valor e vê quem
//  vai precisar assinar.
// ============================================================

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import {
  listarAlcadas, criarAlcada, simularAlcada, dinheiro,
  type RegraAlcada,
} from '../../servicos/cadastros';
import { listarFuncoes, ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, ErroFormulario } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Icone } from '../../componentes/Icone';
import { Modal } from '../../componentes/Modal';

interface FuncaoItem {
  id: string;
  codigo: string;
  nome: string;
}

function faixaTexto(r: RegraAlcada): string {
  if (r.valorMaximo === null) return 'Acima de ' + dinheiro(r.valorMinimo);
  if (r.valorMinimo === 0) return 'Até ' + dinheiro(r.valorMaximo);
  return dinheiro(r.valorMinimo) + ' a ' + dinheiro(r.valorMaximo);
}

export function Alcadas() {
  const { pode } = useAutenticacao();
  const podeEditar = pode('alcadas.gerenciar');

  const [regras, setRegras] = useState<RegraAlcada[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [a, f] = await Promise.all([listarAlcadas(), listarFuncoes()]);
      setRegras(a.regras);
      setAvisos(a.avisos);
      setFuncoes(f.funcoes.map((x) => ({ id: x.id, codigo: x.codigo, nome: x.nome })));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && regras.length === 0) return <Carregando mensagem="Carregando alçadas..." />;
  if (erro && regras.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Limites de alçada"
          descricao={
            <>
              Definem quem precisa assinar cada compra, conforme o valor. O fluxo enviado
            pela Porto Inc. deixou esse limite como <em>"A definir"</em> — os valores
            abaixo são um ponto de partida e podem ser mudados a qualquer momento.
            </>
          }
        />

        {avisos.length > 0 && (
          <div className="aviso aviso--atencao" role="alert">
            <Icone nome="alerta" className="aviso__icone" />
            <div>
              <strong>Atenção às faixas configuradas</strong>
              <ul className="campo__erro-lista">
                {avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        <Simulador />
      </section>

      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Faixas configuradas</h2>
        </div>

        {podeEditar && (
          <div className="barra-acoes">
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => setAberto(true)}
            >
              + Nova faixa
            </button>
          </div>
        )}
        <FormularioFaixa
          key={String(aberto)}
          aberto={aberto}
          aoFechar={() => setAberto(false)}
          funcoes={funcoes}
          aoSalvar={async (descricao) => {
            setAberto(false);
            setAviso('Faixa "' + descricao + '" criada.');
            await carregar();
          }}
        />

        <Cartao semEspaco>
          {regras.length === 0 ? (
            <Vazio
              titulo="Nenhuma faixa de alçada configurada"
              descricao="Sem faixa, nenhuma solicitação sabe quem precisa assinar. Use “+ Nova faixa” para criar a primeira."
            />
          ) : (
            <TabelaArea>
              <table className="tabela">
              <caption className="apenas-leitor-tela">
                Faixas de valor e quem aprova cada uma
              </caption>
              <thead>
                <tr>
                  <th scope="col">Faixa de valor</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Quem aprova</th>
                  <th scope="col">Regra</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {regras.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{faixaTexto(r)}</th>
                    <td>{r.descricao}</td>
                    <td>
                      <span className="etiquetas">
                        {r.funcoes.map((f) => (
                          <span key={f.id} className="etiqueta">
                            {f.nome}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>
                      {r.exigeTodas ? (
                        <Selo tipo="atencao">Todas assinam</Selo>
                      ) : (
                        <Selo tipo="info">Qualquer uma</Selo>
                      )}
                    </td>
                    <td>
                      {r.ativa ? (
                        <Selo tipo="sucesso">Ativa</Selo>
                      ) : (
                        <Selo tipo="erro">Inativa</Selo>
                      )}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </TabelaArea>
          )}
        </Cartao>
      </section>
    </>
  );
}

// ------------------------------------------------------------
//  Simulador
// ------------------------------------------------------------
function Simulador() {
  const [valor, setValor] = useState('7500');
  const [resposta, setResposta] = useState<string | null>(null);
  const [encontrada, setEncontrada] = useState(true);
  const [consultando, setConsultando] = useState(false);

  const consultar = useCallback(async (quantia: number) => {
    setConsultando(true);
    try {
      const r = await simularAlcada(quantia);
      setEncontrada(r.encontrada);
      setResposta(r.explicacao ?? r.mensagem ?? null);
    } catch {
      setResposta('Não foi possível simular agora.');
      setEncontrada(false);
    } finally {
      setConsultando(false);
    }
  }, []);

  useEffect(() => {
    void consultar(7500);
  }, [consultar]);

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    const quantia = Number(valor);
    if (Number.isFinite(quantia) && quantia >= 0) void consultar(quantia);
  }

  return (
    <form onSubmit={aoEnviar}>
      <Cartao className="simulador" nivel={2} titulo="Simulador: quem aprova?">
        <p className="campo__ajuda">
          Digite um valor de compra e veja na hora quem precisará assinar.
        </p>

        <div className="barra-acoes">
          <div className="campo campo--inline campo--curto">
            <label className="apenas-leitor-tela" htmlFor="valor-simulacao">
              Valor da compra em reais
            </label>
            <input
              id="valor-simulacao"
              type="number"
              min="0"
              step="0.01"
              className="campo__entrada"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          {/* Secundário, e não principal: a ação da TELA é "+ Nova
              faixa". Quando dois botões competem pela mesma atenção,
              nenhum dos dois é o próximo passo. */}
          <button type="submit" className="botao botao--secundario" disabled={consultando}>
            {consultando ? 'Consultando...' : 'Simular'}
          </button>

          <div className="atalhos-valor">
            {[500, 5000, 50000].map((v) => (
              <button
                key={v}
                type="button"
                className="botao botao--discreto"
                onClick={() => {
                  setValor(String(v));
                  void consultar(v);
                }}
              >
                {dinheiro(v)}
              </button>
            ))}
          </div>
        </div>

        {resposta && (
          <p className={'aviso ' + (encontrada ? 'aviso--sucesso' : 'aviso--atencao')} role="status">
            <span className="aviso__icone" aria-hidden="true">
              <Icone nome={encontrada ? 'certo' : 'alerta'} />
            </span>
            <span>{resposta}</span>
          </p>
        )}
      </Cartao>
    </form>
  );
}

// ------------------------------------------------------------
//  Nova faixa
// ------------------------------------------------------------
function FormularioFaixa({
  aberto,
  aoFechar,
  funcoes,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  funcoes: FuncaoItem[];
  aoSalvar: (descricao: string) => Promise<void>;
}) {
  const idForm = useId();
  const [descricao, setDescricao] = useState('');
  const [valorMinimo, setValorMinimo] = useState('');
  const [valorMaximo, setValorMaximo] = useState('');
  const [semTeto, setSemTeto] = useState(false);
  const [exigeTodas, setExigeTodas] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  function alternar(id: string) {
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
      await criarAlcada({
        descricao,
        valorMinimo: Number(valorMinimo) || 0,
        valorMaximo: semTeto ? null : Number(valorMaximo) || 0,
        exigeTodas,
        funcoes: selecionadas,
      });
      await aoSalvar(descricao);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível criar a faixa.');
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
      titulo="Nova faixa de alçada"
      descricao="A faixa diz quem precisa assinar uma compra, conforme o valor dela."
      temAlteracao={Boolean(descricao || valorMinimo || selecionadas.length > 0)}
      acoes={
        <>
          <button type="button" className="botao botao--discreto" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            form={idForm}
            className="botao botao--principal"
            disabled={enviando || !descricao || selecionadas.length === 0}
          >
            {enviando ? 'Salvando...' : 'Criar faixa'}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate>

        <Campo
          rotulo="Descrição"
          valor={descricao}
          aoMudar={setDescricao}
          exemplo="Compras de valor médio"
          obrigatorio
        />

        <div className="formulario__linha">
          <Campo
            rotulo="Valor mínimo (R$)"
            valor={valorMinimo}
            aoMudar={setValorMinimo}
            tipo="number"
            exemplo="2000"
            obrigatorio
          />
          <Campo
            rotulo="Valor máximo (R$)"
            valor={semTeto ? '' : valorMaximo}
            aoMudar={setValorMaximo}
            tipo="number"
            exemplo="15000"
            desabilitado={semTeto}
            ajuda="A última faixa deve ficar sem teto."
          />
        </div>

        <label className="opcao">
          <input type="checkbox" checked={semTeto} onChange={(e) => setSemTeto(e.target.checked)} />
          <span>Esta é a faixa mais alta (sem valor máximo)</span>
        </label>

        <fieldset className="campo">
          <legend className="campo__rotulo">Quem aprova nesta faixa</legend>
          <div className="opcoes">
            {funcoes.map((f) => (
              <label key={f.id} className="opcao">
                <input
                  type="checkbox"
                  checked={selecionadas.includes(f.id)}
                  onChange={() => alternar(f.id)}
                />
                <span>{f.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="opcao">
          <input
            type="checkbox"
            checked={exigeTodas}
            onChange={(e) => setExigeTodas(e.target.checked)}
          />
          <span>
            Exigir a assinatura de <strong>todas</strong> as funções marcadas
            {!exigeTodas && ' (hoje: basta uma delas)'}
          </span>
        </label>

        {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

      </form>
    </Modal>
  );
}
