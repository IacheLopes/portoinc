// ============================================================
//  Catálogo de materiais e serviços
//
//  Aqui ficam os três campos que a reunião pediu separados:
//  código Porto, código de barras e norma técnica (NBR).
// ============================================================

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import {
  listarMateriais, listarFamilias, importarMateriais, criarMaterial, editarMaterial, biparCodigo, opcoesDeUnidade,
  type Material, type Familia, type TipoItem,
} from '../../servicos/cadastros';
import { quantidade } from '../../servicos/texto';
import { ErroApi } from '../../servicos/api';
import { useAutenticacao } from '../../contexto/Autenticacao';
import { Campo, Selecao, ErroFormulario } from '../../componentes/Campo';
import { Selo } from '../../componentes/Selo';
import { Carregando, Erro, Vazio } from '../../componentes/Estado';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Cartao } from '../../componentes/Cartao';
import { PainelDeImportacao } from '../../componentes/PainelDeImportacao';
import { TabelaArea } from '../../componentes/TabelaArea';
import { Paginacao, ContaDaPagina } from '../../componentes/Paginacao';
import { usePagina } from '../../ganchos/pagina';
import { Icone } from '../../componentes/Icone';
import { Modal } from '../../componentes/Modal';
import { useEsperarDigitar } from '../../ganchos/esperarDigitar';
import { AvisoDeCriacao } from '../../componentes/AvisoDeCriacao';

const MODELO_MATERIAIS =
  'familia;codigo;descricao;unidade;marca;norma;gtin;ponto_pedido;linha_orcamento\n' +
  'CIM;00119;Cimento Portland CP-II-Z-32 saco 50kg;SC;Votoran;NBR 16697;;50;03.01.001\n' +
  'ELE;00087;Cabo flexivel 2,5mm2 750V rolo 100m;RL;Sil;NBR NM 247-3;;8;09.01.001';

export function Materiais() {
  const { pode } = useAutenticacao();
  const podeEditar = pode('materiais.gerenciar');
  // `null` = cadastrando um item novo. Com item dentro = corrigindo.
  const [editando, setEditando] = useState<Material | null>(null);

  const [materiais, setMateriais] = useState<Material[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  /** O painel de importar planilha está aberto? */
  const [importando, setImportando] = useState(false);

  const [busca, setBusca] = useState('');
  const [familiaId, setFamiliaId] = useState('');
  const [tipo, setTipo] = useState<'' | TipoItem>('');

  // A lista suspensa vale na hora; o campo de digitar espera a
  // pessoa parar, para nao buscar a cada tecla.
  const buscaAdiada = useEsperarDigitar(busca);

  const pag = usePagina(buscaAdiada + '|' + familiaId + '|' + tipo);

  const carregar = useCallback(
    async (
      filtros: { busca?: string; familiaId?: string; tipo?: TipoItem; pagina?: number } = {},
    ) => {
      setCarregando(true);
      setErro(null);
      try {
        const [m, f] = await Promise.all([listarMateriais(filtros), listarFamilias()]);
        setMateriais(m.materiais);
        setFamilias(f.familias);
        pag.chegou(m);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Falha ao carregar.');
        pag.falhou();
      } finally {
        setCarregando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    void carregar({
      busca: buscaAdiada || undefined,
      familiaId: familiaId || undefined,
      tipo: tipo || undefined,
      pagina: pag.pagina,
    });
  }, [carregar, buscaAdiada, familiaId, tipo, pag.pagina]);


  if (carregando && materiais.length === 0) return <Carregando mensagem="Carregando catálogo..." />;
  if (erro && materiais.length === 0) {
    return <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />;
  }

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Materiais e serviços"
          descricao={
            <>
              O catálogo da Porto Inc. Serviço não tem código de barras e não entra no estoque.
            </>
          }
          acoes={
            podeEditar && (
              <>
                {/* IMPORTAR VEM ANTES DE CRIAR, para quem está
                    mudando da planilha: 400 materiais a dedo são
                    4.000 campos. O botão é secundário porque, no
                    dia a dia, cadastrar um item é o comum. */}
                <button
                  type="button"
                  className="botao botao--secundario"
                  onClick={() => setImportando((x) => !x)}
                  aria-expanded={importando}
                >
                  <Icone nome="anexo" /> Importar planilha
                </button>
                <button
                  type="button"
                  className="botao botao--principal"
                  onClick={() => setAberto(true)}
                >
                  + Novo item
                </button>
              </>
            )
          }
        />

        {importando && (
          <PainelDeImportacao
            titulo="Importar catálogo de planilha"
            modelo={MODELO_MATERIAIS}
            oQueEntra={{ um: 'material', muitos: 'materiais' }}
            ajuda={
              <p>
                <strong>Família, código, descrição e unidade</strong> são obrigatórios —
                os mesmos do formulário. A família vem pelo <strong>código</strong> dela
                (ELE, HID), e precisa existir antes.
              </p>
            }
            aoImportar={importarMateriais}
            aoConcluir={async (mensagem) => {
              setImportando(false);
              setAviso(mensagem);
              await carregar();
            }}
          />
        )}

        {aviso && (
          <p className="aviso aviso--sucesso" role="status">
            <Icone nome="certo" /> {aviso}
          </p>
        )}

        <div className="barra-acoes">
          <Campo
            rotulo="Buscar"
            valor={busca}
            aoMudar={setBusca}
            tipo="search"
            exemplo="descrição, código ou marca"
            semMarcaOpcional
          />

          <Selecao
            rotulo="Família"
            valor={familiaId}
            aoMudar={setFamiliaId}
            semMarcaOpcional
            vazio="Todas as famílias"
            opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.nome }))}
          />

          <Selecao
            rotulo="Tipo"
            valor={tipo}
            aoMudar={(v) => setTipo(v as '' | TipoItem)}
            semMarcaOpcional
            vazio="Material e serviço"
            opcoes={[
              { valor: 'MATERIAL', rotulo: 'Só material' },
              { valor: 'SERVICO', rotulo: 'Só serviço' },
            ]}
          />

        </div>
        {/* Um modal so para cadastrar e para corrigir: sao os mesmos
            doze campos, e manter dois formularios iguais garantiria que
            um dia eles ficariam diferentes. A `key` remonta quando o
            alvo muda, para o formulario nascer com os valores certos. */}
        <FormularioMaterial
          key={editando?.id ?? String(aberto)}
          aberto={aberto}
          item={editando}
          aoFechar={() => {
            setAberto(false);
            setEditando(null);
          }}
          familias={familias}
          aoSalvar={async (descricao, corrigiu) => {
            setAberto(false);
            setEditando(null);
            setAviso('"' + descricao + (corrigiu ? '" corrigido.' : '" cadastrado no catálogo.'));
            void carregar({ busca: busca || undefined, familiaId: familiaId || undefined, tipo: tipo || undefined });
          }}
        />
      </section>

      <section className="secao secao-com-ancora" ref={pag.topo}>
        <ContaDaPagina
          pagina={pag.pagina}
          total={pag.dados.total}
          porPagina={pag.dados.porPagina}
          oQue="item"
          oQuePlural="itens"
          carregando={pag.trocando}
        />

        {materiais.length === 0 ? (
          <Vazio
            titulo="Nenhum item encontrado"
            descricao="Ajuste os filtros ou cadastre um item novo."
          />
        ) : (
          <Cartao
            semEspaco
            key={pag.pagina}
            className={pag.trocando ? 'lista-trocando' : 'lista-chegou'}
          >
            <TabelaArea>
              <table className="tabela">
                <caption className="apenas-leitor-tela">
                  Catálogo de materiais e serviços da Porto Inc.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Cód. Porto</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Família</th>
                    <th scope="col">Un.</th>
                    <th scope="col">Cód. de barras</th>
                    <th scope="col">Norma</th>
                    <th scope="col" className="numero">Ponto de pedido</th>
                    <th scope="col">
                      <span className="apenas-leitor-tela">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {materiais.map((m) => (
                    <tr key={m.id}>
                      <th scope="row" className="mono">
                        {m.codigoInterno}
                      </th>
                      <td>
                        {m.descricao}
                        {m.marca && <small className="linha-extra">{m.marca}</small>}
                        {m.tipo === 'SERVICO' && (
                          <>
                            {' '}
                            <Selo tipo="info">Serviço</Selo>
                          </>
                        )}
                      </td>
                      <td>
                        <span className="etiqueta">{m.familia.codigo}</span>
                      </td>
                      <td className="mono">{m.unidadeMedida}</td>
                      <td className="mono">{m.gtin ?? '—'}</td>
                      <td>{m.normaTecnica ?? '—'}</td>
                      <td className="numero">
                        {m.pontoPedido !== null ? quantidade(m.pontoPedido) : '—'}
                      </td>
                      <td className="celula-acoes">
                        {podeEditar && (
                          <button
                            type="button"
                            className="botao botao--discreto"
                            onClick={() => {
                              setEditando(m);
                              setAberto(true);
                            }}
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaArea>
          </Cartao>
        )}

        {/* Aqui dizia "{materiais.length} item(ns) listado(s)" — o
            tamanho do que CHEGOU. Com o catalogo cortado em 200,
            a frase afirmava "200 itens listados" havendo 1.400, e
            o item 201 nao aparecia em tela nenhuma. O numero agora
            vem contado no banco, com o mesmo filtro da busca, e
            mora acima da lista, onde o olho cai. */}
        <Paginacao
          pagina={pag.pagina}
          paginas={pag.dados.paginas}
          aoTrocar={pag.irPara}
          carregando={pag.trocando}
        />
      </section>
    </>
  );
}

// ------------------------------------------------------------
//  Formulário
// ------------------------------------------------------------
function FormularioMaterial({
  aberto,
  item,
  aoFechar,
  familias,
  aoSalvar,
}: {
  aberto: boolean;
  /** Preenchido = corrigindo. Vazio = cadastrando um item novo. */
  item: Material | null;
  aoFechar: () => void;
  familias: Familia[];
  aoSalvar: (descricao: string, corrigiu: boolean) => Promise<void>;
}) {
  const idForm = useId();
  const corrigindo = item !== null;

  const [familiaId, setFamiliaId] = useState(item?.familia.id ?? '');
  const [codigoInterno, setCodigoInterno] = useState(item?.codigoInterno ?? '');
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [tipo, setTipo] = useState<TipoItem>(item?.tipo ?? 'MATERIAL');
  const [marca, setMarca] = useState(item?.marca ?? '');
  const [gtin, setGtin] = useState(item?.gtin ?? '');
  const [normaTecnica, setNormaTecnica] = useState(item?.normaTecnica ?? '');
  const [unidadeMedida, setUnidadeMedida] = useState(item?.unidadeMedida ?? 'UN');
  const [pontoPedido, setPontoPedido] = useState(
    item?.pontoPedido !== null && item?.pontoPedido !== undefined ? String(item.pontoPedido) : '',
  );
  const [codigoLinhaPadrao, setCodigoLinhaPadrao] = useState(item?.codigoLinhaPadrao ?? '');

  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [avisoGtin, setAvisoGtin] = useState<string | null>(null);

  const ehServico = tipo === 'SERVICO';

  // Ao sair do campo de código de barras, confere se já existe.
  async function conferirGtin() {
    setAvisoGtin(null);
    if (!gtin.trim()) return;

    try {
      const r = await biparCodigo(gtin.trim());
      // Corrigindo, o proprio item aparece na busca pelo seu codigo de
      // barras. Acusar "ja esta cadastrado" nele mesmo seria mentira.
      if (r.encontrado && r.material.id !== item?.id) {
        setAvisoGtin('Este código já está cadastrado em "' + r.material.descricao + '".');
      }
    } catch {
      /* não encontrado: é o caso normal ao cadastrar item novo */
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setDetalhes([]);
    setEnviando(true);

    const campos = {
      familiaId,
      codigoInterno,
      descricao,
      tipo,
      marca: marca || undefined,
      gtin: ehServico ? undefined : gtin || undefined,
      normaTecnica: normaTecnica || undefined,
      unidadeMedida,
      pontoPedido: pontoPedido ? Number(pontoPedido) : undefined,
      codigoLinhaPadrao: codigoLinhaPadrao || undefined,
    };

    try {
      if (item) await editarMaterial(item.id, campos);
      else await criarMaterial(campos);

      await aoSalvar(descricao, corrigindo);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setDetalhes((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro(corrigindo ? 'Não foi possível salvar.' : 'Não foi possível cadastrar.');
      }
      setEnviando(false);
    }
  }

  return (
    /* O botao de enviar mora no RODAPE do modal, fora do <form>, e
       alcanca o formulario pelo atributo `form`: um submit fora do
       formulario continua enviando aquele formulario. Assim o rodape
       fica onde o padrao manda, sem estado a mais. */
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={corrigindo ? 'Editar item do catálogo' : 'Novo item de catálogo'}
      descricao={
        corrigindo
          ? 'A unidade e o código aparecem no pedido e na nota. Trocar aqui troca em todo lugar.'
          : 'É deste catálogo que a solicitação escolhe o que pedir.'
      }
      temAlteracao={
        corrigindo
          ? familiaId !== item.familia.id
            || codigoInterno !== item.codigoInterno
            || descricao !== item.descricao
            || tipo !== item.tipo
            || marca !== (item.marca ?? '')
            || gtin !== (item.gtin ?? '')
            || normaTecnica !== (item.normaTecnica ?? '')
            || unidadeMedida !== item.unidadeMedida
            || codigoLinhaPadrao !== (item.codigoLinhaPadrao ?? '')
            || pontoPedido !== (item.pontoPedido !== null ? String(item.pontoPedido) : '')
          : Boolean(familiaId || codigoInterno || descricao)
      }
      acoes={
        <>
          <button type="button" className="botao botao--discreto" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            form={idForm}
            className="botao botao--principal"
            disabled={enviando || !familiaId || !codigoInterno || !descricao}
          >
            {enviando ? 'Salvando...' : corrigindo ? 'Salvar alterações' : 'Cadastrar item'}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate>
        {!corrigindo && (
          <AvisoDeCriacao>
            O <strong>Código Porto</strong> e a <strong>unidade de medida</strong> saem
            impressos no pedido de compra e na nota fiscal. Errar a unidade estraga a conta
            de toda compra que vier deste item.
          </AvisoDeCriacao>
        )}

        <div className="formulario__linha">
          <Selecao
            rotulo="Tipo"
            valor={tipo}
            aoMudar={(v) => setTipo(v as TipoItem)}
            opcoes={[
              { valor: 'MATERIAL', rotulo: 'Material' },
              { valor: 'SERVICO', rotulo: 'Serviço' },
            ]}
            ajuda={ehServico ? 'Serviço não tem código de barras nem estoque.' : undefined}
            obrigatorio
          />
          <Selecao
            rotulo="Família"
            valor={familiaId}
            aoMudar={setFamiliaId}
            opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.codigo + ' — ' + f.nome }))}
            vazio="Escolha a família..."
            ajuda="Define quais fornecedores serão convidados para cotar."
            obrigatorio
          />
        </div>

        <div className="formulario__linha">
          <Campo
            rotulo="Código Porto"
            valor={codigoInterno}
            aoMudar={setCodigoInterno}
            exemplo="00119"
            ajuda="O mesmo código usado nas planilhas da empresa."
            obrigatorio
          />
          <Selecao
            rotulo="Unidade de medida"
            valor={unidadeMedida}
            aoMudar={setUnidadeMedida}
            opcoes={opcoesDeUnidade()}
            obrigatorio
          />
        </div>

        <Campo
          rotulo="Descrição"
          valor={descricao}
          aoMudar={setDescricao}
          exemplo="Cimento Portland CP-II-Z-32 saco 50kg"
          ajuda="Quanto mais específica, menos erro na cotação e no recebimento."
          obrigatorio
        />

        <div className="formulario__linha">
          <Campo rotulo="Marca" valor={marca} aoMudar={setMarca} exemplo="Votoran" />
          <Campo
            rotulo="Norma técnica (NBR)"
            valor={normaTecnica}
            aoMudar={setNormaTecnica}
            exemplo="NBR 16697"
            ajuda="Norma ABNT que o item precisa cumprir."
          />
        </div>

        {!ehServico && (
          <div className="formulario__linha">
            <div onBlur={() => void conferirGtin()}>
              <Campo
                rotulo="Código de barras (GTIN)"
                valor={gtin}
                aoMudar={setGtin}
                exemplo="7899888400575"
                erro={avisoGtin ?? undefined}
                ajuda="O sistema confere o dígito verificador ao salvar."
              />
            </div>
            <Campo
              rotulo="Ponto de pedido"
              valor={pontoPedido}
              aoMudar={setPontoPedido}
              tipo="number"
              exemplo="50"
              ajuda="Abaixo desta quantidade o sistema avisa que é hora de comprar."
            />
          </div>
        )}

        <Campo
          rotulo="Linha de orçamento sugerida"
          valor={codigoLinhaPadrao}
          aoMudar={setCodigoLinhaPadrao}
          exemplo="03.01.001"
          ajuda="Vem preenchida na solicitação, e pode ser trocada lá. Como o mesmo item é usado em várias obras, guardamos só o código da linha."
        />

        {erro && <ErroFormulario mensagem={erro} detalhes={detalhes} />}

      </form>
    </Modal>
  );
}
