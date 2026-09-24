// ============================================================
//  Painel de decisão do aprovador
//
//  Aparece dentro da solicitação, para quem pode assinar.
//
//  Cuidados aplicados aqui:
//   - a ação destrutiva (reprovar) não fica do lado da comum
//   - devolver exige explicar o motivo, e a tela cobra isso
//   - o botão mostra em que pé está a aprovação antes de clicar
// ============================================================

import { useState } from 'react';
import { decidir, nomeDaFuncao, type Decisao, type EstadoAprovacao } from '../servicos/solicitacoes';
import { ErroApi } from '../servicos/api';
import { Selo } from './Selo';
import { Icone } from './Icone';

interface Props {
  solicitacaoId: string;
  estado: EstadoAprovacao;
  exigeTodas: boolean;
  funcoesExigidas: string[];
  /** Funções do usuário que servem para assinar esta solicitação. */
  minhasFuncoesUteis: string[];
  aoDecidir: (mensagem: string) => Promise<void>;
}

export function PainelDecisao({
  solicitacaoId,
  estado,
  exigeTodas,
  funcoesExigidas,
  minhasFuncoesUteis,
  aoDecidir,
}: Props) {
  const [escolhida, setEscolhida] = useState<Decisao | null>(null);
  const [observacao, setObservacao] = useState('');
  const [funcaoCodigo, setFuncaoCodigo] = useState(minhasFuncoesUteis[0] ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const precisaMotivo = escolhida === 'DEVOLVIDA';
  const faltaMotivo = precisaMotivo && observacao.trim() === '';

  async function confirmar() {
    if (!escolhida || faltaMotivo) return;

    setErro(null);
    setEnviando(true);

    try {
      const r = await decidir(
        solicitacaoId,
        escolhida,
        observacao.trim() || undefined,
        funcaoCodigo || undefined,
      );
      await aoDecidir(r.mensagem);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível registrar a decisão.');
      setEnviando(false);
    }
  }

  return (
    <div className="cartao painel-decisao">
      <h2 className="formulario__titulo">Sua decisão</h2>

      <p className="painel-decisao__estado">
        {exigeTodas ? (
          <Selo tipo="atencao">
            {estado.assinaram.length} de {funcoesExigidas.length} assinaturas
          </Selo>
        ) : (
          <Selo tipo="info">Basta uma assinatura</Selo>
        )}{' '}
        {estado.resumo}
      </p>

      {minhasFuncoesUteis.length > 1 && (
        <div className="campo">
          <label className="campo__rotulo" htmlFor="funcao-assinatura">
            Assinar como
          </label>
          <select
            id="funcao-assinatura"
            className="campo__entrada"
            value={funcaoCodigo}
            onChange={(e) => setFuncaoCodigo(e.target.value)}
          >
            {minhasFuncoesUteis.map((f) => (
              <option key={f} value={f}>
                {nomeDaFuncao(f)}
              </option>
            ))}
          </select>
          <p className="campo__ajuda">
            Você acumula mais de uma função exigida. Cada uma assina separadamente.
          </p>
        </div>
      )}

      <fieldset className="campo">
        <legend className="campo__rotulo">O que você decide?</legend>
        <div className="decisoes">
          <label className={'decisao' + (escolhida === 'APROVADA' ? ' decisao--ativa' : '')}>
            <input
              type="radio"
              name="decisao"
              checked={escolhida === 'APROVADA'}
              onChange={() => setEscolhida('APROVADA')}
            />
            <Icone nome="certo" className="decisao__icone" />
            <span className="decisao__texto">
              <strong>Aprovar</strong>
              <small>Libera a solicitação para cotação</small>
            </span>
          </label>

          <label className={'decisao' + (escolhida === 'DEVOLVIDA' ? ' decisao--ativa' : '')}>
            <input
              type="radio"
              name="decisao"
              checked={escolhida === 'DEVOLVIDA'}
              onChange={() => setEscolhida('DEVOLVIDA')}
            />
            <Icone nome="voltar" className="decisao__icone" />
            <span className="decisao__texto">
              <strong>Devolver para revisão</strong>
              <small>O solicitante corrige e reenvia</small>
            </span>
          </label>

          <label
            className={
              'decisao decisao--perigo' + (escolhida === 'REPROVADA' ? ' decisao--ativa' : '')
            }
          >
            <input
              type="radio"
              name="decisao"
              checked={escolhida === 'REPROVADA'}
              onChange={() => setEscolhida('REPROVADA')}
            />
            <span className="decisao__icone" aria-hidden="true">✕</span>
            <span className="decisao__texto">
              <strong>Reprovar</strong>
              <small>Encerra o pedido. Não tem volta</small>
            </span>
          </label>
        </div>
      </fieldset>

      {escolhida && (
        <>
          <div className="campo">
            <label className="campo__rotulo" htmlFor="observacao-decisao">
              Observação
              {precisaMotivo ? (
                <span className="campo__exigido"> — obrigatória para devolver</span>
              ) : (
                <span className="campo__opcional"> (opcional)</span>
              )}
            </label>
            <textarea
              id="observacao-decisao"
              className="campo__entrada campo__area campo__area--curta"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              aria-invalid={faltaMotivo}
              placeholder={
                precisaMotivo
                  ? 'Explique o que precisa ser corrigido...'
                  : 'Algo que o comprador precise saber...'
              }
            />
            {faltaMotivo && (
              <p className="campo__erro" role="alert">
                <Icone nome="alerta" /> Sem explicar o motivo, o solicitante não
                sabe o que corrigir.
              </p>
            )}
          </div>

          {escolhida === 'REPROVADA' && (
            <div className="aviso aviso--erro">
              <Icone nome="alerta" className="aviso__icone" />
              <div>
                <strong>Reprovar encerra o pedido definitivamente.</strong>
                <p>
                  Se o problema for corrigível, prefira <strong>Devolver para revisão</strong>.
                </p>
              </div>
            </div>
          )}

          {erro && (
            <p className="campo__erro" role="alert">
              <Icone nome="alerta" /> {erro}
            </p>
          )}

          <div className="formulario__acoes">
            <button
              type="button"
              className={
                'botao ' + (escolhida === 'REPROVADA' ? 'botao--perigo' : 'botao--principal')
              }
              onClick={() => void confirmar()}
              disabled={enviando || faltaMotivo}
            >
              {enviando
                ? 'Registrando...'
                : escolhida === 'APROVADA'
                  ? 'Confirmar aprovação'
                  : escolhida === 'DEVOLVIDA'
                    ? 'Devolver ao solicitante'
                    : 'Confirmar reprovação'}
            </button>

            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => {
                setEscolhida(null);
                setObservacao('');
                setErro(null);
              }}
              disabled={enviando}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
