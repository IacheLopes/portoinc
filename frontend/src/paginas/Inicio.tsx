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
import { MODULOS, MODULO_COMPLETO, ETAPAS_PRONTAS, ETAPAS_TOTAIS } from '../navegacao';
import { CabecalhoDePagina } from '../componentes/CabecalhoDePagina';
import { Indicador } from '../componentes/Indicador';
import { Carregando, Erro } from '../componentes/Estado';
import { buscarInicio, type ResumoDoInicio } from '../servicos/inicio';
import { ErroApi } from '../servicos/api';

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function Inicio() {
  const { usuario, pode } = useAutenticacao();

  const [resumo, setResumo] = useState<ResumoDoInicio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';

  const meus = MODULOS.filter(
    (m) => m.noInicio !== false && m.permissoes.length > 0 && pode(...m.permissoes),
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

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo={saudacao() + ', ' + primeiroNome}
          descricao={
            <>
              Você está no sistema como{' '}
              <strong>
                {usuario?.funcoes.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(' e ')}
              </strong>
              .
            </>
          }
        />
      </section>

      {/* ----------------------------------------------------
          1. O que precisa de você
          ---------------------------------------------------- */}
      <section className="secao">
        <div className="secao__cabecalho">
          <h2>O que precisa de você</h2>
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
            <span className="aviso__icone" aria-hidden="true">✓</span>
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
          <div className="grade">
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
          {meus.map((modulo) => (
            <Link key={modulo.para} to={modulo.para} className="atalho">
              <span className="atalho__icone" aria-hidden="true">
                {modulo.icone}
              </span>
              <span className="atalho__texto">
                <strong>{modulo.titulo}</strong>
                <small>{modulo.descricao}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------
          O aviso de andamento, no fim e em voz baixa.
          Ele fala do PROJETO, não do trabalho de quem abriu a
          tela — e ocupava o lugar mais valioso da página.
          ---------------------------------------------------- */}
      <section className="secao">
        <p className="nota-do-rodape">
          {MODULO_COMPLETO
            ? 'Módulo 1 completo — ' + ETAPAS_TOTAIS + ' etapas entregues.'
            : 'Sistema em construção — ' + ETAPAS_PRONTAS + ' de ' + ETAPAS_TOTAIS + ' etapas.'}
          {' '}As integrações externas rodam em <strong>modo de teste</strong>: nada sai do
          sistema para fora. Detalhes em <Link to="/admin/status">Status do sistema</Link>.
        </p>
      </section>
    </>
  );
}
