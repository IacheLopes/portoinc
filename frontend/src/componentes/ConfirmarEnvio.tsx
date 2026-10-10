// ============================================================
//  Confirmar antes de mandar coisa para fora da empresa
//
//  MODAL QUE SÓ PERGUNTA "TEM CERTEZA?" É QUEBRA-MOLAS.
//
//  Em três dias a pessoa aprende a clicar em "Sim" sem ler, e aí
//  ele atrasa o trabalho sem proteger de nada. Por isso aqui a
//  pergunta está no TÍTULO e o corpo é a lista de quem vai
//  receber — que é a única coisa que dá para conferir.
//
//  O risco real não é o clique acidental: é mandar o convite para
//  o fornecedor errado, ou descobrir depois que o modo de teste
//  bloqueou tudo. A lista pega os dois.
//
//  Cada linha carrega o que vai acontecer com ELA. Sem isso, três
//  destinos com três desfechos diferentes viram um parágrafo que
//  ninguém lê.
// ============================================================

import { Modal } from './Modal';
import { Icone } from './Icone';

/** Um destinatário e o que vai acontecer com ele. */
export interface DestinoDoEnvio {
  /** Nome do fornecedor, como aparece no resto do sistema. */
  nome: string;
  /**
   * Telefone ou e-mail, POR INTEIRO.
   *
   * O sistema mascara número na tela de Comunicação e no histórico —
   * lá são listas de telefone de gente, vistas de passagem. Aqui
   * é o contrário: a pessoa está CONFERINDO o destinatário, e a
   * tabela de fornecedores atrás deste modal já mostra o número
   * completo. Esconder aqui deixaria o modal pior que a tela que
   * ele interrompe.
   */
  contato: string | null;
}

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
  ocupado: boolean;
  canal: 'whatsapp' | 'email';
  /** "convite" ou "pedido" — o que está sendo mandado. */
  oQue: 'convite' | 'pedido';
  /** O documento: "BID-00007" ou "PC-00002". */
  referencia: string;
  destinos: DestinoDoEnvio[];
  /** Quando ligado, quem não está liberado não recebe. */
  modoTeste: boolean;
  /** Vai um arquivo junto? */
  anexo?: string;
}

const CANAL = {
  whatsapp: { nome: 'WhatsApp', icone: 'conversa' as const, semContato: 'sem WhatsApp cadastrado' },
  email: { nome: 'e-mail', icone: 'envelope' as const, semContato: 'sem e-mail cadastrado' },
};

export function ConfirmarEnvio({
  aberto, aoFechar, aoConfirmar, ocupado,
  canal, oQue, referencia, destinos, modoTeste, anexo,
}: Props) {
  const c = CANAL[canal];

  const alcancaveis = destinos.filter((d) => d.contato !== null);
  const semContato = destinos.length - alcancaveis.length;

  // O verbo é o mesmo do botão que abriu e da mensagem que aparece
  // depois. Quem clica em "Convidar" lê "Enviar convite" e recebe
  // "convite enviado" — uma palavra só atravessando o caminho.
  const acao = oQue === 'convite' ? 'Enviar' : 'Mandar';
  const substantivo = oQue === 'convite' ? 'convite' : 'pedido';

  const rotuloBotao = ocupado
    ? 'Enviando...'
    : alcancaveis.length > 1
      ? acao + ' ' + alcancaveis.length + ' ' + substantivo + 's'
      : acao + ' ' + substantivo;

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={acao + ' ' + substantivo + ' pelo ' + c.nome}
      descricao={
        oQue === 'convite'
          ? 'O ' + substantivo + ' da ' + referencia + ' sai agora para quem está na lista.'
          : 'O ' + referencia + ' sai agora para o fornecedor.'
      }
      acoes={
        <>
          <button
            type="button"
            className="botao botao--secundario"
            onClick={aoFechar}
            disabled={ocupado}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="botao botao--principal"
            onClick={aoConfirmar}
            disabled={ocupado || alcancaveis.length === 0}
          >
            <Icone nome={c.icone} /> {rotuloBotao}
          </button>
        </>
      }
    >
      <ul className="destinos">
        {destinos.map((d) => (
          <li key={d.nome} className={'destinos__linha' + (d.contato ? '' : ' destinos__linha--fora')}>
            <span className="destinos__nome">{d.nome}</span>
            <span className="destinos__contato">
              {d.contato ?? c.semContato}
            </span>
          </li>
        ))}
      </ul>

      {anexo && alcancaveis.length > 0 && (
        <p className="texto-fraco">
          <Icone nome="documento" /> Vai com o {anexo} em anexo.
        </p>
      )}

      {/* O aviso do modo de teste vem ANTES, não depois.
          Hoje a pessoa só descobre que foi bloqueado quando já
          clicou e a mensagem não chegou em ninguém. */}
      {modoTeste && alcancaveis.length > 0 && canal === 'whatsapp' && (
        <div className="aviso aviso--atencao">
          <Icone nome="alerta" className="aviso__icone" />
          <div>
            <strong>Envio restrito.</strong>
            <p>
              Só recebe quem estiver na lista de números liberados, em
              Comunicação. Quem não estiver aparece como bloqueado no histórico.
            </p>
          </div>
        </div>
      )}

      {alcancaveis.length === 0 && (
        <div className="aviso aviso--erro">
          <Icone nome="alerta" className="aviso__icone" />
          <div>
            <strong>Não há para quem mandar.</strong>
            <p>
              {semContato === 1
                ? 'O fornecedor da lista não tem ' + c.nome + ' cadastrado.'
                : 'Nenhum dos ' + semContato + ' fornecedores tem ' + c.nome + ' cadastrado.'}{' '}
              Cadastre em Fornecedores, ou use o outro canal.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
