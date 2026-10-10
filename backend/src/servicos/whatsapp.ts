// ============================================================
//  A única porta de saída do WhatsApp
//
//  NENHUMA mensagem sai do sistema sem passar por aqui. Nem a
//  tela de teste, nem a cotação, nem o pedido de compra.
//
//  Motivo: a trava de segurança precisa valer para todos. Se
//  cada tela chamasse o adaptador direto, bastaria uma esquecer
//  de conferir a lista para uma mensagem cair no celular de um
//  desconhecido.
// ============================================================

import { banco } from '../plugins/banco.js';
import { integracoes } from '../integracoes/index.js';
import { ambiente } from '../config/ambiente.js';
import { mascarar, normalizarTelefone } from '../integracoes/whatsapp/adaptador.baileys.js';
import { dataBr } from './data-br.js';

export { mascarar, normalizarTelefone };

export interface PedidoDeEnvio {
  para: string;
  texto: string;
  /** Nome de quem vai receber, para o histórico ficar legível. */
  destino?: string | null;
  anexo?: { nomeArquivo: string; conteudo: Buffer; tipoMime: string };
  contexto?: 'teste' | 'cotacao' | 'pedido';
  referencia?: string | null;
  usuarioId?: string | null;
}

export interface RespostaDeEnvio {
  sucesso: boolean;
  bloqueado: boolean;
  mensagem: string;
  idMensagem?: string;
  registroId: string;
}

/** O modo de teste está ligado? */
export function modoTeste(): boolean {
  return ambiente.WHATSAPP_MODO_TESTE !== 'false';
}

/**
 * Confere se o número pode receber mensagem.
 *
 * Com o modo de teste ligado, só sai para quem está na lista de
 * autorizados. Sem ele, sai para qualquer número — por isso
 * desligar é uma decisão consciente, feita no .env.
 */
export async function podeEnviarPara(numero: string): Promise<boolean> {
  if (!modoTeste()) return true;

  const digitos = numero.replace(/\D/g, '');
  const autorizado = await banco.numeroAutorizado.findUnique({ where: { numero: digitos } });

  return autorizado !== null;
}

/**
 * Envia (ou recusa) e SEMPRE registra o que aconteceu.
 *
 * Mesmo o bloqueio vira registro: se alguém tentou mandar para
 * fora da lista, isso precisa aparecer no histórico.
 */
export async function enviarPeloWhatsApp(pedido: PedidoDeEnvio): Promise<RespostaDeEnvio> {
  const adaptador = integracoes.whatsapp;

  let digitos: string;
  try {
    digitos = normalizarTelefone(pedido.para);
  } catch (erro) {
    const registro = await registrar({
      numero: pedido.para.replace(/\D/g, ''),
      pedido,
      situacao: 'FALHOU',
      adaptador: adaptador.nome,
      erro: erro instanceof Error ? erro.message : 'Número inválido.',
    });

    return {
      sucesso: false,
      bloqueado: false,
      mensagem: erro instanceof Error ? erro.message : 'Número inválido.',
      registroId: registro,
    };
  }

  // ---------- A trava ----------
  if (!(await podeEnviarPara(digitos))) {
    const registro = await registrar({
      numero: digitos,
      pedido,
      situacao: 'BLOQUEADA',
      adaptador: adaptador.nome,
      erro: 'Número fora da lista de autorizados (envio restrito).',
    });

    return {
      sucesso: false,
      bloqueado: true,
      mensagem:
        'O número ' +
        mascarar(digitos) +
        ' não está na lista de autorizados. Enquanto o envio estiver restrito, ' +
        'o sistema só envia para os números que você liberar.',
      registroId: registro,
    };
  }

  const resultado = await adaptador.enviar({
    para: digitos,
    texto: pedido.texto,
    anexo: pedido.anexo,
  });

  const registro = await registrar({
    numero: digitos,
    pedido,
    situacao: resultado.sucesso ? 'ENVIADA' : 'FALHOU',
    adaptador: resultado.adaptador,
    idMensagem: resultado.idMensagem,
    erro: resultado.erro,
  });

  return {
    sucesso: resultado.sucesso,
    bloqueado: false,
    mensagem: resultado.sucesso
      ? 'Mensagem enviada para ' + mascarar(digitos) + '.'
      : (resultado.erro ?? 'Falha ao enviar.'),
    idMensagem: resultado.idMensagem,
    registroId: registro,
  };
}

async function registrar(dados: {
  numero: string;
  pedido: PedidoDeEnvio;
  situacao: 'ENVIADA' | 'FALHOU' | 'BLOQUEADA';
  adaptador: string;
  idMensagem?: string;
  erro?: string;
}): Promise<string> {
  const criado = await banco.mensagemEnviada.create({
    data: {
      numero: dados.numero,
      destino: dados.pedido.destino ?? null,
      texto: dados.pedido.texto.slice(0, 4000),
      temAnexo: Boolean(dados.pedido.anexo),
      situacao: dados.situacao,
      idMensagem: dados.idMensagem ?? null,
      erro: dados.erro ?? null,
      adaptador: dados.adaptador,
      contexto: dados.pedido.contexto ?? null,
      referencia: dados.pedido.referencia ?? null,
      enviadoPorId: dados.pedido.usuarioId ?? null,
    },
    select: { id: true },
  });

  return criado.id;
}

// ------------------------------------------------------------
//  Textos prontos
// ------------------------------------------------------------

/** O convite da cotação, com o link do portal do fornecedor. */
export function textoConviteCotacao(dados: {
  numeroBid: string;
  titulo: string;
  prazo: Date;
  link: string;
  quantidadeItens: number;
}): string {
  const prazo = dataBr(dados.prazo);

  return [
    'Porto Inc. — Pedido de cotação ' + dados.numeroBid,
    '',
    dados.titulo,
    dados.quantidadeItens +
      (dados.quantidadeItens === 1 ? ' item para cotar.' : ' itens para cotar.'),
    '',
    'Responda pelo link abaixo até ' + prazo + ':',
    dados.link,
    '',
    'Não precisa de cadastro nem de senha.',
  ].join('\n');
}

/** O aviso de que o pedido de compra saiu, com o PDF em anexo. */
export function textoPedidoDeCompra(dados: {
  numeroPedido: string;
  fornecedor: string;
  total: string;
  pagamento: string;
}): string {
  return [
    'Porto Inc. — Pedido de compra ' + dados.numeroPedido,
    '',
    'Olá, ' + dados.fornecedor + '.',
    'Segue em anexo o nosso pedido de compra.',
    '',
    'Total: ' + dados.total,
    'Pagamento: ' + dados.pagamento,
    '',
    'IMPORTANTE: informe o número ' +
      dados.numeroPedido +
      ' na nota fiscal e na entrega. É por ele que o almoxarifado confere o material.',
  ].join('\n');
}
