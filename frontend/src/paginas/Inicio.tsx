// ============================================================
//  Painel inicial
//
//  Mostra quem você é e o que o sistema libera para você.
//
//  Os cartões e o aviso de andamento saem de `navegacao.ts`, a
//  mesma lista que monta o menu lateral. Antes eram listas
//  separadas, e esta tela ficou anunciando que faltavam os
//  relatórios depois que eles já estavam prontos.
// ============================================================

import { Link } from 'react-router-dom';
import { useAutenticacao } from '../contexto/Autenticacao';
import {
  MODULOS,
  ETAPAS_PRONTAS,
  ETAPAS_TOTAIS,
  MODULO_COMPLETO,
  FINALIZACAO,
  oQueFalta,
} from '../navegacao';
import { CabecalhoDePagina } from '../componentes/CabecalhoDePagina';

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function Inicio() {
  const { usuario, pode } = useAutenticacao();

  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';
  const meus = MODULOS.filter(
    (m) => m.noInicio !== false && m.permissoes.length > 0 && pode(...m.permissoes),
  );

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo={saudacao() + ', ' + primeiroNome}
          descricao={
            <>
              Você está no sistema como{' '}
            <strong>{usuario?.funcoes.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(' e ')}</strong>
            , com {usuario?.permissoes.length} permissões liberadas.
            </>
          }
        />

        <div className={'aviso ' + (MODULO_COMPLETO ? 'aviso--sucesso' : 'aviso--info')}>
          <span className="aviso__icone" aria-hidden="true">
            {MODULO_COMPLETO ? '✅' : '🚧'}
          </span>
          <div>
            <strong>
              {MODULO_COMPLETO
                ? `Módulo 1 completo — ${ETAPAS_TOTAIS} etapas entregues.`
                : `Sistema em construção — ${ETAPAS_PRONTAS} de ${ETAPAS_TOTAIS} etapas concluídas.`}
            </strong>
            <p>
              Da solicitação ao pagamento, com o fornecedor avisado pelo WhatsApp, o
              estoque controlado, os relatórios e a locação de equipamentos. {oQueFalta()}
            </p>
            <p>
              As integrações externas rodam em <strong>modo de teste</strong>: nada sai
              do sistema para fora. {FINALIZACAO.resumo}
            </p>
          </div>
        </div>
      </section>

      <section className="secao">
        <div className="secao__cabecalho">
          <h2>O que você pode fazer</h2>
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
    </>
  );
}
