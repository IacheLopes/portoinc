// ============================================================
//  Receitas e despesas
//
//  A TELA QUE NÃO EXISTIA.
//
//  Iache perguntou onde se cadastra a receita da empresa e a
//  despesa que não vem de compra. Não havia resposta: o financeiro
//  só sabia tirar, porque toda saída nascia da nota do fornecedor
//  e entrada nenhuma tinha lugar.
//
//  A tela responde, nesta ordem:
//
//    1. Quanto a Porto Inc. TEM?     → saldo
//    2. De onde veio e para onde foi? → entrou / saiu
//    3. Como termina se tudo acontecer? → previsto
//    4. Quais lançamentos exatamente?   → tabela
//
//  O saldo vem primeiro porque é a pergunta. Os outros três
//  existem para explicá-lo — quem vê um saldo e não entende de
//  onde saiu volta a conferir no papel.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarLancamentos, buscarCaixa, criarLancamento, editarLancamento,
  realizarLancamento, voltarParaPrevisto, cancelarLancamento, exportarLancamentos, buscarEventos,
  ROTULO_SITUACAO, COR_SITUACAO,
  type Lancamento, type ResumoDoCaixa, type TipoLancamento, type EventoDoLancamento,
} from '../../servicos/lancamentos';
import { listarObras, type Obra } from '../../servicos/cadastros';
import { dinheiro } from '../../servicos/texto';
import { dataBr } from '../../servicos/solicitacoes';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import {
  CartaoIndicador, GraficoCalendario, GraficoRosca, degrauDaFileira,
  CORES_DE_CATEGORIA,
} from '../../componentes/Graficos';
import { BotaoBaixar, type FormatoDeArquivo } from '../../componentes/BotaoBaixar';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { Modal } from '../../componentes/Modal';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Paginacao, ContaDaPagina } from '../../componentes/Paginacao';
import { MenuDeAcoes } from '../../componentes/MenuDeAcoes';
import { usePagina } from '../../ganchos/pagina';
import { Icone } from '../../componentes/Icone';
import { mascaraDinheiro, dinheiroCompleto, lerDinheiro } from '../../servicos/mascaras';

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Duas datas no mesmo dia? Então repetir o dia seria ruído. */
function mesmoDia(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

/** O formulário em branco. Entrada por padrão: é o que faltava. */
function formularioVazio() {
  return {
    tipo: 'RECEITA' as TipoLancamento,
    descricao: '',
    valor: '',
    previstoPara: hojeIso(),
    obraId: '',
    categoria: '',
    formaPagamento: '',
    observacoes: '',
    jaAconteceu: true,
    aberturaDeCaixa: false,
  };
}

type Formulario = ReturnType<typeof formularioVazio>;

export function Lancamentos() {
  const { pode } = useAutenticacao();
  const podeGerenciar = pode('financeiro.gerenciar');

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [resumo, setResumo] = useState<ResumoDoCaixa | null>(null);
  const [obras, setObras] = useState<Obra[]>([]);

  const [tipo, setTipo] = useState('');
  const [situacao, setSituacao] = useState('');
  const [obraFiltro, setObraFiltro] = useState('');

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const pag = usePagina(tipo + '|' + situacao + '|' + obraFiltro);

  // ----------------------------------------------------------
  //  O formulário
  //
  //  Um só para lançar e para corrigir: os campos são os mesmos, e
  //  duas telas parecidas divergiriam na primeira mudança.
  //  `editando` guarda o id quando é correção, e é nulo quando é
  //  lançamento novo.
  // ----------------------------------------------------------
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario>(formularioVazio);
  const [mexeu, setMexeu] = useState(false);

  const [cancelando, setCancelando] = useState<Lancamento | null>(null);
  const [motivo, setMotivo] = useState('');

  // A trilha. Carregada só quando alguém pede para ver.
  const [trilhaDe, setTrilhaDe] = useState<Lancamento | null>(null);
  const [trilha, setTrilha] = useState<EventoDoLancamento[] | null>(null);

  async function abrirTrilha(l: Lancamento) {
    setTrilhaDe(l);
    setTrilha(null);
    try {
      const r = await buscarEventos(l.id);
      setTrilha(r.eventos);
    } catch {
      setTrilha([]);
    }
  }

  function mudar<C extends keyof Formulario>(campo: C, valor: Formulario[C]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setMexeu(true);
  }

  const carregar = useCallback(
    async (t: string, s: string, o: string, pagina: number) => {
      setCarregando(true);
      setErro(null);
      try {
        // As duas chamadas juntas: o saldo conta TUDO no servidor, a
        // lista traz uma página. Somar a página daria um saldo que
        // muda quando se vira a página — o defeito que a etapa de
        // paginação achou em três indicadores do início.
        const [lista, saldo] = await Promise.all([
          listarLancamentos({ tipo: t, situacao: s, obraId: o, pagina }),
          buscarCaixa(o || undefined),
        ]);

        setLancamentos(lista.lancamentos);
        setResumo(saldo);
        pag.chegou(lista);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar os lançamentos.');
        pag.falhou();
      } finally {
        setCarregando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    void carregar(tipo, situacao, obraFiltro, pag.pagina);
  }, [carregar, tipo, situacao, obraFiltro, pag.pagina]);

  useEffect(() => {
    // A lista de obras é para o campo de obra, e muda de mês em mês.
    // Falhar aqui não impede lançar: obra é opcional.
    void listarObras()
      .then((r) => setObras(r.obras))
      .catch(() => setObras([]));
  }, []);

  function recarregar() {
    return carregar(tipo, situacao, obraFiltro, pag.pagina);
  }

  // ----------------------------------------------------------
  //  Abrir e fechar
  // ----------------------------------------------------------
  function abrirNovo(qual: TipoLancamento) {
    setEditando(null);
    setForm({ ...formularioVazio(), tipo: qual, obraId: obraFiltro });
    setMexeu(false);
    setErro(null);
    setAberto(true);
  }

  function abrirCorrecao(l: Lancamento) {
    setEditando(l.id);
    setForm({
      tipo: l.tipo,
      descricao: l.descricao,
      valor: dinheiroCompleto(String(l.valor).replace('.', ',')),
      previstoPara: l.previstoPara.slice(0, 10),
      obraId: l.obra?.id ?? '',
      categoria: l.categoria ?? '',
      formaPagamento: l.formaPagamento ?? '',
      observacoes: l.observacoes ?? '',
      jaAconteceu: l.situacao === 'REALIZADO',
      aberturaDeCaixa: l.aberturaDeCaixa,
    });
    setMexeu(false);
    setErro(null);
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    setEditando(null);
    setMexeu(false);
    // O erro era DO formulário. Deixando-o de pé, fechar a janela
    // mandava "Informe um valor maior que zero" para o topo da
    // página, sozinho, sem nada por perto que explicasse de onde
    // veio.
    setErro(null);
  }

  function fecharCancelamento() {
    setCancelando(null);
    setMotivo('');
    setErro(null);
  }

  // ----------------------------------------------------------
  //  Gravar
  // ----------------------------------------------------------
  async function gravar() {
    const valor = lerDinheiro(form.valor);

    if (!Number.isFinite(valor as number) || (valor as number) <= 0) {
      setErro('Informe um valor maior que zero.');
      return;
    }

    setOcupado(true);
    setErro(null);

    try {
      const dados = {
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        valor: valor as number,
        previstoPara: form.previstoPara,
        obraId: form.obraId || null,
        categoria: form.categoria.trim() || undefined,
        formaPagamento: form.formaPagamento.trim() || undefined,
        observacoes: form.observacoes.trim() || undefined,
      };

      if (editando) {
        await editarLancamento(editando, dados);
        setAviso('Lançamento corrigido.');
      } else {
        const r = await criarLancamento({
          ...dados,
          jaAconteceu: form.jaAconteceu,
          aberturaDeCaixa: form.aberturaDeCaixa,
        });
        setAviso(
          r.lancamento.numeroFormatado + ' lançado: ' +
          (form.tipo === 'RECEITA' ? 'entrada' : 'saída') + ' de ' +
          dinheiro(r.lancamento.valor) + '.',
        );
      }

      fechar();
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível gravar o lançamento.');
    } finally {
      setOcupado(false);
    }
  }

  async function registrar(l: Lancamento) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await realizarLancamento(l.id, hojeIso());
      setAviso(r.mensagem);
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível registrar.');
    } finally {
      setOcupado(false);
    }
  }

  /** Desfaz o "já aconteceu" de quem marcou sem querer. */
  async function desfazer(l: Lancamento) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await voltarParaPrevisto(l.id);
      setAviso(r.mensagem);
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível voltar para previsto.');
    } finally {
      setOcupado(false);
    }
  }

  async function baixar(formato: FormatoDeArquivo) {
    setErro(null);
    try {
      // Os MESMOS filtros da tela. Quem filtrou "só saídas" e
      // recebe um papel com as entradas juntas só descobre depois
      // de imprimir.
      await exportarLancamentos(formato, {
        tipo: tipo || undefined,
        situacao: situacao || undefined,
        obraId: obraFiltro || undefined,
      });
    } catch {
      setErro('Não foi possível gerar o arquivo.');
    }
  }

  async function confirmarCancelamento() {
    if (!cancelando) return;

    setOcupado(true);
    setErro(null);
    try {
      await cancelarLancamento(cancelando.id, motivo.trim());
      setAviso(cancelando.numeroFormatado + ' cancelado.');
      setCancelando(null);
      setMotivo('');
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível cancelar.');
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !resumo) return <Carregando mensagem="Somando o caixa..." />;
  if (erro && !resumo) return <Erro mensagem={erro} aoTentarNovamente={() => void recarregar()} />;
  if (!resumo) return null;

  const { caixa, deOndeVem, paraOndeVai, calendario, semanas } = resumo;

  // Só desenha o que tem o que dizer. Rosca de uma fatia e
  // calendário de seis semanas vazias são moldura em volta de nada
  // — e numa instalação nova é exatamente o que apareceria.
  const temCategorias = deOndeVem.length > 0 || paraOndeVai.length > 0;
  const temFuturo = calendario.some((s) => s.entra > 0 || s.sai > 0);

  // QUEM NÃO PÔS CATEGORIA MERECE SABER DISSO.
  //
  // O dono lançou R$ 20 milhões sem categoria e disse que o gasto
  // "não apareceu no gráfico". Apareceu — como "Sem categoria", 100%
  // do bolo — e foi justamente por isso que não pareceu aparecer: a
  // rosca virou um círculo só e as outras fatias sumiram.
  //
  // O gráfico estava certo e o aviso faltava. Um grafico que nao
  // ensina o que fazer com ele e so desenho.
  const semCategoria = paraOndeVai.find((f) => f.nome === 'Sem categoria');

  // Os quatro cartões descem juntos, pelo mais comprido deles.
  const degrauDosCartoes = degrauDaFileira(
    dinheiro(caixa.saldo),
    dinheiro(caixa.entrou),
    dinheiro(caixa.saiu),
    dinheiro(caixa.previsto),
  );

  /**
   * Soma de um tipo NA PÁGINA que está na tela.
   *
   * Cancelado fica de fora: ele continua na lista para quem for
   * auditar, mas não é dinheiro.
   */
  function somaDaPagina(qual: TipoLancamento): number {
    const soma = lancamentos
      .filter((l) => l.tipo === qual && l.situacao !== 'CANCELADO')
      .reduce((s, l) => s + l.valor, 0);

    return Math.round(soma * 100) / 100;
  }

  const daObra = obraFiltro
    ? obras.find((o) => o.id === obraFiltro)
    : undefined;

  const opcoesDeObra = [
    { valor: '', rotulo: 'Todas as obras e a empresa' },
    ...obras.map((o) => ({ valor: o.id, rotulo: o.codigo + ' — ' + o.nome })),
  ];

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Receitas e despesas"
          descricao={
            <>
              Aqui entra o dinheiro que não vem de compra: a medição que o cliente pagou, o
              aporte dos sócios, o combustível, o aluguel do container. As compras continuam
              nascendo da nota fiscal, em <Link to="/financeiro/contas">contas a pagar</Link>.
            </>
          }
          acoes={
            podeGerenciar ? (
              <>
                <button
                  type="button"
                  className="botao botao--principal"
                  onClick={() => abrirNovo('RECEITA')}
                >
                  <Icone nome="entrada" /> Lançar entrada
                </button>
                <button
                  type="button"
                  className="botao botao--secundario"
                  onClick={() => abrirNovo('DESPESA')}
                >
                  <Icone nome="dinheiro" /> Lançar saída
                </button>
              </>
            ) : undefined
          }
        />

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        {/* O erro aparece UMA vez.

            Com um modal aberto, o mesmo texto nascia aqui e lá
            dentro, os dois com `role="alert"`: atrás do véu
            ninguém lia o de fora, mas o leitor de tela anunciava
            os dois. Enquanto há formulário aberto, a mensagem
            mora dentro dele, que é onde está o foco. */}
        {erro && !aberto && cancelando === null && (
          <p className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" /> {erro}
          </p>
        )}

        {/* ------------------------------------------------------
            O saldo primeiro.

            Era a pergunta sem resposta. Os três ao lado existem
            para explicá-lo: um saldo sozinho faz quem olha ir
            conferir no papel de onde ele saiu.
            ------------------------------------------------------ */}
        <div className="painel-financeiro">
          <CartaoIndicador
            degrau={degrauDosCartoes}
            rotulo={daObra ? 'Saldo de ' + daObra.codigo : 'Saldo'}
            valor={dinheiro(caixa.saldo)}
            detalhe={
              caixa.saldo < 0
                ? 'Saiu mais do que entrou'
                : caixa.entrou === 0
                  ? 'Nenhuma entrada registrada ainda'
                  : 'O que sobrou do que já andou'
            }
            explicacao="Entradas recebidas menos tudo que saiu: compras pagas e despesas lançadas aqui. Só conta dinheiro que andou."
            destaque={caixa.saldo < 0 ? 'erro' : caixa.saldo > 0 ? 'sucesso' : undefined}
          />

          <CartaoIndicador
            degrau={degrauDosCartoes}
            rotulo="Entrou"
            valor={dinheiro(caixa.entrou)}
            /* QUANDO PARTE DISSO A EMPRESA JÁ TINHA, O CARTÃO DIZ.
               Quem muda da planilha lança o caixa de abertura, e o
               cartão passava a anunciar R$ 2.000.000,00 de receita
               que ninguém faturou. O número continua certo — é
               dinheiro que entrou —, mas a leitura não era. */
            detalhe={
              caixa.aberturaDeCaixa > 0
                ? 'Sendo ' + dinheiro(caixa.aberturaDeCaixa) + ' de saldo inicial; '
                  + 'faturado aqui: ' + dinheiro(caixa.faturou)
                : caixa.aReceber > 0
                  ? 'Falta receber ' + dinheiro(caixa.aReceber)
                  : 'Nada a receber em aberto'
            }
            explicacao="As receitas que já caíram: medições, aportes, vendas. O saldo que a empresa já tinha ao entrar no sistema também soma aqui, mas aparece separado — ela não faturou esse dinheiro."
          />

          <CartaoIndicador
            degrau={degrauDosCartoes}
            rotulo="Saiu"
            valor={dinheiro(caixa.saiu)}
            detalhe={
              'Compras ' + dinheiro(caixa.detalhe.comprasPagas) +
              ' · avulsas ' + dinheiro(caixa.detalhe.despesasFeitas)
            }
            explicacao="As duas origens de saída somadas: parcelas de nota fiscal pagas e despesas lançadas aqui. O detalhe separa as duas."
          />

          <CartaoIndicador
            degrau={degrauDosCartoes}
            rotulo="Se tudo acontecer"
            valor={dinheiro(caixa.previsto)}
            detalhe={
              'A receber ' + dinheiro(caixa.aReceber) +
              ' · a pagar ' + dinheiro(caixa.aPagar)
            }
            explicacao="Como o caixa fica se cada previsão acontecer: saldo de hoje, mais o a receber, menos o a pagar."
            destaque={caixa.previsto < 0 ? 'atencao' : 'info'}
          />
        </div>
      </section>

      {/* ------------------------------------------------------
          Os gráficos, na ordem das perguntas

          Os cartões acima já disseram QUANTO. Aqui vem QUANDO (o
          calendário) e POR QUÊ (as categorias).

          Nenhum deles repete o painel de Contas a pagar: lá os
          cinco gráficos olham para a compra — a carteira, a
          pontualidade, para quem se deve, o custo por obra. O
          dinheiro que não nasce de compra era invisível.
          ------------------------------------------------------ */}
      {(temFuturo || temCategorias) && (
        <section className="secao">
          <div className="painel-financeiro">
            {temFuturo && (
              <Cartao className="col-cheia">
                <GraficoCalendario
                  semanas={calendario}
                  titulo="O que vem pela frente"
                  descricao={'próximas ' + semanas + ' semanas'}
                />
              </Cartao>
            )}

            {deOndeVem.length > 0 && (
              <Cartao className="col-meia">
                {/* AS DUAS DO PAR SÃO ROSCAS, e isso é escolha.

                    A primeira versão pôs um ranking aqui, porque a
                    entrada costuma ter duas ou três categorias e
                    barra compara tamanho melhor que fatia.

                    Na foto, o defeito de sempre: duas barras ao
                    lado de uma rosca com quatro linhas de legenda
                    deixaram 150px de branco no alto deste cartão.
                    A grade estica o par até a altura do mais alto,
                    e com formas diferentes a altura nunca bate.

                    Mesma forma dos dois lados, mesma altura. E a
                    pergunta é a mesma dos dois lados — que parte do
                    todo —, então rosca serve nos dois. */}
                <GraficoRosca
                  fatias={deOndeVem.map((f, i) => ({
                    rotulo: f.nome,
                    valor: f.valor,
                    percentual: f.percentual,
                    tom: 'info' as const,
                    cor: CORES_DE_CATEGORIA[i % CORES_DE_CATEGORIA.length],
                  }))}
                  titulo="De onde vem o dinheiro"
                  /* A rosca mostra de onde vem o que a empresa
                     GANHOU; o saldo de abertura fica de fora dela,
                     então o centro é `faturou`, não `entrou` —
                     senão as fatias não fecham com o total. */
                  centroValor={dinheiro(caixa.faturou)}
                  centroRotulo="a empresa faturou"
                  rotuloFatia="Categoria"
                />
              </Cartao>
            )}

            {paraOndeVai.length > 0 && (
              <Cartao className="col-meia">
                {/* ROSCA, porque aqui a pergunta É parte do todo:
                    "quanto do meu gasto avulso é frota?". */}
                <GraficoRosca
                  fatias={paraOndeVai.map((f, i) => ({
                    rotulo: f.nome,
                    valor: f.valor,
                    percentual: f.percentual,
                    // O tom nunca é lido: a `cor` vence. Vai 'info'
                    // porque o campo é obrigatório no tipo, que serve
                    // também à carteira, onde vermelho É vencida.
                    tom: 'info' as const,
                    cor: CORES_DE_CATEGORIA[i % CORES_DE_CATEGORIA.length],
                  }))}
                  titulo="Para onde vai o que não é compra"
                  centroValor={dinheiro(caixa.detalhe.despesasFeitas)}
                  centroRotulo="já saiu"
                  rotuloFatia="Categoria"
                />

              </Cartao>
            )}
          </div>

          {/* O EMPURRÃO FICA FORA DO PAR.

              Ele nasceu DENTRO do cartão da direita e esticou só
              aquele: a grade levou o da esquerda junto, e sobraram
              200px de ar em volta de uma rosca de duas fatias.

              E ele nem é do gráfico — é conselho sobre o DADO. Aqui
              embaixo, em largura cheia, o par volta a ter a mesma
              altura e o texto ganha linha inteira para ser lido. */}
          {semCategoria && semCategoria.percentual >= 20 && (
            <p className="aviso aviso--info" role="status">
              <Icone nome="dica" className="aviso__icone" />
              <span>
                <strong>{dinheiro(semCategoria.valor)} sem categoria.</strong> O gráfico
                agrupa pelo campo <em>Categoria</em> do lançamento — preenchê-lo é o que
                faz ele responder para onde o dinheiro vai. Dá para corrigir pelo menu da
                linha, em <em>Corrigir</em>.
              </span>
            </p>
          )}
        </section>
      )}

      {/* ---------- A lista ---------- */}
      <section className="secao secao-com-ancora" ref={pag.topo}>
        <div className="secao__cabecalho">
          <h2>Lançamentos</h2>
        </div>

        <div className="barra-acoes">
          <Selecao
            rotulo="Tipo"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={[
              { valor: '', rotulo: 'Entradas e saídas' },
              { valor: 'RECEITA', rotulo: 'Só entradas' },
              { valor: 'DESPESA', rotulo: 'Só saídas' },
            ]}
            semMarcaOpcional
          />

          <Selecao
            rotulo="Situação"
            valor={situacao}
            aoMudar={setSituacao}
            opcoes={[
              { valor: '', rotulo: 'Todas' },
              { valor: 'PREVISTO', rotulo: 'Previstas' },
              { valor: 'REALIZADO', rotulo: 'Já aconteceram' },
              { valor: 'CANCELADO', rotulo: 'Canceladas' },
            ]}
            semMarcaOpcional
          />

          <Selecao
            rotulo="Obra"
            valor={obraFiltro}
            aoMudar={setObraFiltro}
            opcoes={opcoesDeObra}
            semMarcaOpcional
          />

          <BotaoBaixar
            aoEscolher={(f) => void baixar(f)}
            rotulo="Baixar lançamentos"
            descricao="receitas e despesas"
          />
        </div>

        <div className="conta-da-lista">
          <ContaDaPagina
            pagina={pag.pagina}
            total={pag.dados.total}
            porPagina={pag.dados.porPagina}
            oQue="lançamento"
            oQuePlural="lançamentos"
            carregando={pag.trocando}
          />

          {/* O TOTAL É DA PÁGINA, e o rótulo diz isso.

              Somar o array em mão e chamar de "total" foi o defeito
              que a etapa da paginação achou em oito números do
              sistema. Aqui a soma é honesta porque está nomeada:
              "nesta página". O total de verdade é o dos quatro
              cartões lá em cima, que o servidor calcula sobre tudo. */}
          {lancamentos.length > 0 && (
            <p className="conta-da-lista__soma">
              Nesta página:{' '}
              <strong className="valor-entrada">
                + {dinheiro(somaDaPagina('RECEITA'))}
              </strong>{' '}
              <strong className="valor-saida">
                − {dinheiro(somaDaPagina('DESPESA'))}
              </strong>
            </p>
          )}
        </div>

        {lancamentos.length === 0 ? (
          <Vazio
            titulo="Nenhum lançamento por aqui"
            descricao={
              podeGerenciar
                ? 'Lance a primeira entrada — uma medição recebida, por exemplo — ou mude o filtro.'
                : 'Mude o filtro para ver outros lançamentos.'
            }
          />
        ) : (
          <Cartao
            semEspaco
            key={pag.pagina}
            className={pag.trocando ? 'lista-trocando' : 'lista-chegou'}
          >
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">Receitas e despesas lançadas</caption>
                <thead>
                  <tr>
                    <th scope="col">Lançamento</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Obra</th>
                    <th scope="col" className="numero">Valor</th>
                    <th scope="col">Data</th>
                    <th scope="col">Situação</th>
                    {podeGerenciar && (
                      <th scope="col">
                        <span className="apenas-leitor-tela">Ações</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l) => (
                    <tr key={l.id} className={l.situacao === 'CANCELADO' ? 'linha-cancelada' : undefined}>
                      <th scope="row" className="mono">
                        {l.numeroFormatado}
                        <small className="linha-extra">
                          {l.tipo === 'RECEITA' ? 'entrada' : 'saída'}
                          {l.categoria ? ' · ' + l.categoria : ''}
                        </small>
                      </th>
                      <td className="celula-texto">
                        {l.descricao}
                        {l.formaPagamento && (
                          <small className="linha-extra">{l.formaPagamento}</small>
                        )}
                      </td>
                      <td className="celula-texto">
                        {l.obra ? (
                          <>
                            {l.obra.codigo}
                            <small className="linha-extra">{l.obra.nome}</small>
                          </>
                        ) : (
                          <>
                            Empresa
                            <small className="linha-extra">não é de obra</small>
                          </>
                        )}
                      </td>
                      {/* O sinal fica no VALOR, não numa coluna de
                          tipo: é onde o olho procura. */}
                      <td
                        className={
                          'numero destaque' +
                          (l.situacao === 'CANCELADO'
                            ? ''
                            : l.tipo === 'RECEITA'
                              ? ' valor-entrada'
                              : ' valor-saida')
                        }
                      >
                        {(l.tipo === 'RECEITA' ? '+ ' : '− ') + dinheiro(l.valor)}
                      </td>
                      {/* A data de cima é a MESMA por que a lista se
                          ordena.

                          Mostrando `realizadoEm ?? previstoPara`, um
                          lançamento previsto para janeiro e pago em
                          outubro aparecia no lugar de janeiro exibindo
                          outubro — e a coluna parecia fora de ordem,
                          sem que nada estivesse errado.

                          Quando o dinheiro andou noutro dia, o dia de
                          verdade vem na linha de baixo. Nada se perde. */}
                      <td>
                        {dataBr(l.previstoPara)}
                        <small className="linha-extra">
                          {l.situacao === 'CANCELADO'
                            ? 'cancelado'
                            : l.realizadoEm
                              ? mesmoDia(l.realizadoEm, l.previstoPara)
                                ? 'aconteceu'
                                : 'aconteceu ' + dataBr(l.realizadoEm)
                              : 'previsto'}
                        </small>
                      </td>
                      <td>
                        <Selo tipo={COR_SITUACAO[l.situacao]}>
                          {ROTULO_SITUACAO[l.tipo][l.situacao]}
                        </Selo>
                      </td>
                      {podeGerenciar && (
                        <td>
                          {l.situacao === 'CANCELADO' ? (
                            <span className="texto-fraco">—</span>
                          ) : (
                            <MenuDeAcoes
                              descricao={'Ações do lançamento ' + l.numeroFormatado}
                              acoes={[
                                ...(l.situacao === 'PREVISTO'
                                  ? [
                                      {
                                        rotulo:
                                          l.tipo === 'RECEITA'
                                            ? 'Registrar que entrou'
                                            : 'Registrar que saiu',
                                        icone: <Icone nome="certo" />,
                                        aoEscolher: () => void registrar(l),
                                        desabilitada: ocupado,
                                      },
                                    ]
                                  : []),
                                ...(l.situacao === 'REALIZADO'
                                  ? [
                                      {
                                        rotulo: 'Voltar para previsto',
                                        icone: <Icone nome="voltar" />,
                                        aoEscolher: () => void desfazer(l),
                                        desabilitada: ocupado,
                                      },
                                    ]
                                  : []),
                                {
                                  rotulo: 'Corrigir',
                                  icone: <Icone nome="escrever" />,
                                  aoEscolher: () => abrirCorrecao(l),
                                  desabilitada: ocupado,
                                },
                                {
                                  rotulo: 'Ver histórico',
                                  icone: <Icone nome="prancheta" />,
                                  aoEscolher: () => void abrirTrilha(l),
                                },
                                {
                                  rotulo: 'Cancelar lançamento',
                                  icone: <Icone nome="errado" />,
                                  aoEscolher: () => {
                                    setCancelando(l);
                                    setMotivo('');
                                  },
                                  desabilitada: ocupado,
                                  perigo: true,
                                },
                              ]}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}

        <Paginacao
          pagina={pag.pagina}
          paginas={pag.dados.paginas}
          aoTrocar={pag.irPara}
          carregando={pag.trocando}
        />
      </section>

      {/* ---------- Lançar e corrigir ---------- */}
      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo={
          editando
            ? 'Corrigir lançamento'
            : form.tipo === 'RECEITA'
              ? 'Lançar entrada'
              : 'Lançar saída'
        }
        descricao={
          editando
            ? 'Corrija o que foi digitado errado. A situação não muda aqui.'
            : form.tipo === 'RECEITA'
              ? 'Dinheiro que a Porto Inc. recebeu ou vai receber.'
              : 'Despesa que não vem de compra: frota, aluguel, taxas, diárias de máquina.'
        }
        temAlteracao={mexeu}
        acoes={
          <>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={fechar}
              disabled={ocupado}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="botao botao--principal"
              onClick={() => void gravar()}
              disabled={ocupado}
            >
              {ocupado ? 'Gravando...' : editando ? 'Salvar correção' : 'Lançar'}
            </button>
          </>
        }
      >
        {/* O aviso do topo da página fica ATRÁS do modal: se gravar
            falhar, o motivo precisa aparecer aqui dentro.

            Amarrado ao `aberto` porque o Modal da casa mantém os
            filhos no DOM e só esconde o <dialog>. Sem isto, os dois
            modais da tela mostravam a MESMA mensagem, e a de erro
            do cancelamento aparecia no formulário de lançar. */}
        {erro && aberto && (
          <p className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" /> {erro}
          </p>
        )}

        <div className="formulario__linha">
          <Selecao
            rotulo="Tipo"
            valor={form.tipo}
            aoMudar={(v) => mudar('tipo', v as TipoLancamento)}
            /* Rótulo curto: dentro do campo estreito do modal,
               "Entrada — dinheiro que chega" virava "Entrada — dinheiro
               que ch...". Texto cortado não ensina nada, e o título do
               modal e a linha abaixo dele já dizem o que cada um é. */
            opcoes={[
              { valor: 'RECEITA', rotulo: 'Entrada' },
              { valor: 'DESPESA', rotulo: 'Saída' },
            ]}
            semMarcaOpcional
          />
          <Campo
            rotulo="Valor"
            valor={form.valor}
            aoMudar={(v) => mudar('valor', mascaraDinheiro(v))}
            aoSair={() => mudar('valor', dinheiroCompleto(form.valor))}
            exemplo="1.500,00"
            modoTeclado="decimal"
            obrigatorio
          />
        </div>

        <Campo
          rotulo="Descrição"
          valor={form.descricao}
          aoMudar={(v) => mudar('descricao', v)}
          exemplo={
            form.tipo === 'RECEITA'
              ? 'Medição 3 — Residencial Porto Belo'
              : 'Combustível da frota — outubro'
          }
          ajuda="Quem ler o extrato daqui a seis meses precisa entender o que foi."
          obrigatorio
          maximo={200}
        />

        <div className="formulario__linha">
          <Campo
            rotulo={form.tipo === 'RECEITA' ? 'Data da entrada' : 'Data da saída'}
            valor={form.previstoPara}
            aoMudar={(v) => mudar('previstoPara', v)}
            tipo="date"
            obrigatorio
          />
          <Selecao
            rotulo="Obra"
            valor={form.obraId}
            aoMudar={(v) => mudar('obraId', v)}
            opcoes={[
              { valor: '', rotulo: 'Da empresa' },
              ...obras.map((o) => ({ valor: o.id, rotulo: o.codigo + ' — ' + o.nome })),
            ]}
            ajuda="O aporte dos sócios e o aluguel do escritório são da empresa, não de uma obra."
            semMarcaOpcional
          />
        </div>

        <div className="formulario__linha">
          <Campo
            rotulo="Categoria"
            valor={form.categoria}
            aoMudar={(v) => mudar('categoria', v)}
            exemplo={form.tipo === 'RECEITA' ? 'Medição de obra' : 'Frota'}
            ajuda="Texto livre. A Porto Inc. vai descobrir as categorias dela usando."
            maximo={60}
          />
          <Campo
            rotulo="Forma de pagamento"
            valor={form.formaPagamento}
            aoMudar={(v) => mudar('formaPagamento', v)}
            exemplo="PIX, boleto, transferência"
            maximo={60}
          />
        </div>

        <Campo
          rotulo="Observações"
          valor={form.observacoes}
          aoMudar={(v) => mudar('observacoes', v)}
          maximo={500}
        />

        {/* Só ao lançar: na correção, a situação se muda pela ação
            "Registrar que entrou", que grava a data de verdade. */}
        {!editando && (
          <label className="opcao">
            <input
              type="checkbox"
              checked={form.jaAconteceu}
              onChange={(e) => mudar('jaAconteceu', e.target.checked)}
            />
            <span>
              {form.tipo === 'RECEITA' ? 'O dinheiro já entrou' : 'O dinheiro já saiu'}
              {!form.jaAconteceu &&
                ' — vai ficar como previsto, fora do saldo e dentro de "se tudo acontecer"'}
            </span>
          </label>
        )}

        {/* O DINHEIRO QUE A EMPRESA JÁ TINHA.
            Só na entrada, e só ao lançar. É a porta que faltava
            para quem está mudando da planilha: sem ela, o caixa de
            abertura entrava como receita e o cartão "Entrou"
            anunciava faturamento que ninguém faturou. */}
        {!editando && form.tipo === 'RECEITA' && (
          <label className="opcao">
            <input
              type="checkbox"
              checked={form.aberturaDeCaixa}
              onChange={(e) => mudar('aberturaDeCaixa', e.target.checked)}
            />
            <span>
              Este dinheiro a empresa <strong>já tinha</strong> ao entrar no sistema
              {form.aberturaDeCaixa
                ? ' — soma no saldo, e fica de fora do faturamento'
                : ''}
            </span>
          </label>
        )}
      </Modal>

      {/* ---------- O histórico ----------

          SÓ LEITURA, e por isso um botão só: fechar.

          A trilha existe para responder "quem mexeu neste valor?".
          Um botão de ação aqui dentro convidaria a mexer no lugar
          onde se vem conferir. */}
      <Modal
        aberto={trilhaDe !== null}
        aoFechar={() => setTrilhaDe(null)}
        titulo={'Histórico de ' + (trilhaDe?.numeroFormatado ?? '')}
        descricao={trilhaDe ? trilhaDe.descricao : undefined}
        acoes={
          <button
            type="button"
            className="botao botao--secundario"
            onClick={() => setTrilhaDe(null)}
          >
            Fechar
          </button>
        }
      >
        {trilha === null && <p className="texto-fraco">Buscando o histórico...</p>}

        {trilha !== null && trilha.length === 0 && (
          <p className="texto-fraco">
            Este lançamento é anterior ao histórico. Daí para frente, toda correção fica
            registrada aqui.
          </p>
        )}

        {trilha !== null && trilha.length > 0 && (
          <ol className="trilha">
            {trilha.map((e) => (
              <li key={e.id} className="trilha__item">
                <span className="trilha__quando">
                  {dataBr(e.quando)}
                  <small>{e.quem}</small>
                </span>
                <span className="trilha__texto">{e.descricao}</span>
              </li>
            ))}
          </ol>
        )}
      </Modal>

      {/* ---------- Cancelar ---------- */}
      <Modal
        aberto={cancelando !== null}
        aoFechar={fecharCancelamento}
        titulo={'Cancelar ' + (cancelando?.numeroFormatado ?? '')}
        descricao={
          cancelando
            ? cancelando.descricao + ' · ' + dinheiro(cancelando.valor) +
              ' · o lançamento continua na lista, marcado como cancelado'
            : undefined
        }
        temAlteracao={motivo.trim().length > 0}
        acoes={
          <>
            <button
              type="button"
              className="botao botao--secundario"
              onClick={fecharCancelamento}
              disabled={ocupado}
            >
              Voltar
            </button>
            <button
              type="button"
              className="botao botao--perigo"
              onClick={() => void confirmarCancelamento()}
              disabled={ocupado || motivo.trim().length < 3}
            >
              {ocupado ? 'Cancelando...' : 'Cancelar lançamento'}
            </button>
          </>
        }
      >
        {erro && cancelando !== null && (
          <p className="aviso aviso--erro" role="alert">
            <Icone nome="alerta" /> {erro}
          </p>
        )}

        <Campo
          rotulo="Motivo"
          valor={motivo}
          aoMudar={setMotivo}
          exemplo="Lançado em duplicidade."
          ajuda="Fica escrito nas observações. Quem auditar daqui a um ano precisa saber por quê."
          obrigatorio
          maximo={300}
        />

        <p className="texto-fraco">
          Lançamento não se apaga: um buraco na numeração não se explica sozinho.
        </p>
      </Modal>
    </>
  );
}
