// ============================================================
//  Tela inicial
//
//  Ela responde uma pergunta só: **o que precisa de você agora?**
//
//  Até o Design 3 era um muro de treze atalhos — todos dizendo
//  "clique aqui", nenhum dizendo se havia algo para fazer. Quem
//  chegava de manhã abria tela por tela para descobrir que três
//  parcelas venceram ontem.
//
//  A ordem da página é a ordem da pergunta:
//
//    1. O que está atrasado ou vence — e leva direto até lá
//    2. Como estão as outras frentes
//    3. Para onde ir, quando não é nada disso
//
//  Os números vêm de `/api/inicio`, já filtrados pelas permissões
//  de quem pediu. A tela não recalcula nada: se ela e a fila de
//  aprovação discordassem, uma das duas estaria mentindo.
// ============================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAutenticacao } from '../contexto/Autenticacao';
import { barraLateral } from '../navegacao';
import { CabecalhoDePagina } from '../componentes/CabecalhoDePagina';
import { Indicador } from '../componentes/Indicador';
import { Carregando, Erro } from '../componentes/Estado';
import { buscarInicio, type ResumoDoInicio } from '../servicos/inicio';
import { ErroApi } from '../servicos/api';
import { Icone } from '../componentes/Icone';

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * A linha sob o nome de cada destino.
 *
 * Mora aqui, e não no `navegacao.ts`, porque é texto de VENDA da
 * tela inicial — diz o que a pessoa vai achar lá dentro. A
 * descrição do `navegacao.ts` é o subtítulo da própria tela índice,
 * e as duas fazem trabalhos diferentes.
 */
const DESCRICAO_DO_DESTINO: Record<string, string> = {
  '/': 'A tela inicial',
  '/relatorios': 'Orçamento, economia, fornecedores, tempos e consumo',
  '/compras': 'Solicitar, aprovar, cotar e emitir o pedido',
  '/almoxarifado': 'Receber a entrega, controlar o estoque e as locações',
  '/financeiro': 'Contas a pagar, notas fiscais e o caixa da empresa',
  '/administracao': 'Catálogo, obras, alçadas, pessoas e comunicação',
};

export function Inicio() {
  const { usuario, pode } = useAutenticacao();

  const [resumo, setResumo] = useState<ResumoDoInicio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';

  // OS MESMOS QUATRO DESTINOS DA BARRA, e não as 14 telas.
  //
  // Enquanto a barra listava tudo, listar tudo aqui também era
  // coerente. Com a barra em seis linhas, 14 cartões aqui seriam
  // trocar o problema de lugar: a primeira tela que alguém vê numa
  // demonstração continuaria dizendo "isto é enorme".
  //
  // Lendo da MESMA função que monta a barra, as duas não têm como
  // divergir — foi exatamente assim que a tela inicial passou meses
  // anunciando módulos que já existiam.
  const meus = barraLateral(
    (m) => m.permissoes.length > 0 && pode(...m.permissoes),
  );

  async function carregar() {
    setCarregando(true);
    setErro(null);

    try {
      setResumo(await buscarInicio());
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar o seu resumo.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urgentes = resumo?.urgentes ?? [];
  const acompanhar = resumo?.acompanhar ?? [];

  // As funções que uma PESSOA da empresa pode ter. `FORNECEDOR` fica
  // de fora: fornecedor não entra no sistema, responde por um link.
  //
  // Quem carrega todas as sete não é gente: é a conta de
  // desenvolvimento, e a tela tem de dizer isso com todas as letras.
  const FUNCOES_DE_PESSOA = [
    'ADMINISTRADOR', 'FUNDADOR', 'GESTOR_OBRA', 'ENGENHEIRO',
    'COMPRADOR', 'SOLICITANTE', 'ALMOXARIFE',
  ];
  const temTodasAsFuncoes = FUNCOES_DE_PESSOA.every((f) => usuario?.funcoes.includes(f));

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo={temTodasAsFuncoes ? 'Conta de Desenvolvedor' : saudacao() + ', ' + primeiroNome}
          descricao={
            /* Quem acumula TODAS as funções não é uma pessoa da
               empresa: é a conta de desenvolvimento. Listar as sete
               ("administrador e fundador e gestor obra e...") não
               diz nada — pior, faz parecer que existe alguém com
               todos esses cargos. */
            /* Sem "Bom dia, DEV-Porto": cumprimentar uma conta de
               sistema como se fosse gente é a primeira incoerência.
               A segunda é os números de baixo parecerem "seus" —
               eles são da empresa inteira, porque esta conta enxerga
               tudo. A tela avisa antes que alguém tire conclusão
               errada de um número. */
            temTodasAsFuncoes ? (
              <>
                Esta conta acumula as <strong>sete funções</strong>: ela abre todas as telas
                e vê a fila de aprovações de todo mundo. Serve para testar e conferir defeito.
                <br />
                Os números abaixo são <strong>da empresa inteira</strong>, e não de uma pessoa.
              </>
            ) : (
              <>
                Você está no sistema como{' '}
                <strong>
                  {usuario?.funcoes.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(' e ')}
                </strong>
                .
              </>
            )
          }
        />
      </section>

      {/* ----------------------------------------------------
          1. O que precisa de você
          ---------------------------------------------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          {/* "de você" é verdade para quem tem um papel no processo.
              Para a conta que enxerga tudo, o certo é "de alguém":
              ali aparece o que está travado na empresa inteira. */}
          <h2>{temTodasAsFuncoes ? 'O que precisa de alguém' : 'O que precisa de você'}</h2>
          <p className="secao__descricao">
            Prazo perdido primeiro, depois o que vence se ninguém agir.
          </p>
        </div>

        {carregando && <Carregando mensagem="Carregando o seu resumo..." />}

        {erro && !carregando && (
          <Erro mensagem={erro} aoTentarNovamente={() => void carregar()} />
        )}

        {!carregando && !erro && urgentes.length === 0 && (
          <div className="aviso aviso--sucesso">
            <Icone nome="certo" className="aviso__icone" />
            <div>
              <strong>Nada esperando por você.</strong>
              <p>
                Nenhum prazo perdido e nada vencendo nos próximos dias, dentro do que
                você acompanha. Os números abaixo mostram como estão as outras frentes.
              </p>
            </div>
          </div>
        )}

        {!carregando && !erro && urgentes.length > 0 && (
          // `--destaque`: linha inteira no celular. Ver global.css.
          <div className="grade grade--destaque">
            {urgentes.map((c) => (
              <Indicador
                key={c.chave}
                titulo={c.rotulo}
                valor={c.valor}
                detalhe={c.detalhe}
                tom={c.tom}
                para={c.para}
              />
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------
          2. Como estão as coisas
          ---------------------------------------------------- */}
      {!carregando && !erro && acompanhar.length > 0 && (
        <section className="secao">
          <div className="secao__cabecalho">
            <h2>Como estão as coisas</h2>
            <p className="secao__descricao">
              Bom saber, não cobra nada. Cada número abre a tela onde ele mora.
            </p>
          </div>

          <div className="grade">
            {acompanhar.map((c) => (
              <Indicador
                key={c.chave}
                titulo={c.rotulo}
                valor={c.valor}
                detalhe={c.detalhe}
                para={c.para}
              />
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------
          3. Para onde ir
          ---------------------------------------------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>Ir para</h2>
          <p className="secao__descricao">
            Esta lista muda conforme as funções de cada pessoa.
          </p>
        </div>

        <div className="grade">
          {meus.map((destino) => (
            <Link key={destino.para} to={destino.para} className="atalho">
              <Icone nome={destino.icone} className="atalho__icone" />
              <span className="atalho__texto">
                <strong>{destino.rotulo}</strong>
                <small>{DESCRICAO_DO_DESTINO[destino.para] ?? ''}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
