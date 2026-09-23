// ============================================================
//  A única porta de saída do e-mail
//
//  NENHUM e-mail sai do sistema sem passar por aqui. Nem a tela
//  de teste, nem o convite de cotação, nem o pedido de compra.
//
//  Mesmo motivo do WhatsApp: a trava precisa valer para todos.
//  Se cada tela chamasse o adaptador direto, bastaria uma esquecer
//  de conferir a lista para um e-mail cair na caixa de entrada de
//  um fornecedor de verdade antes da hora.
// ============================================================

import { banco } from '../plugins/banco.js';
import { integracoes } from '../integracoes/index.js';
import { ambiente } from '../config/ambiente.js';
import type { AnexoEmail } from '../integracoes/email/porta.js';

export interface PedidoDeEmail {
  para: string;
  assunto: string;
  corpo: string;
  /** Nome de quem vai receber, para o histórico ficar legível. */
  destino?: string | null;
  anexos?: AnexoEmail[];
  contexto?: 'teste' | 'cotacao' | 'pedido';
  referencia?: string | null;
  usuarioId?: string | null;
}

export interface RespostaDeEmail {
  sucesso: boolean;
  bloqueado: boolean;
  mensagem: string;
  idMensagem?: string;
  registroId: string;
}

/**
 * Formato de endereço, sem exagero.
 *
 * Validar e-mail por expressão regular ao pé da letra é um poço
 * sem fundo. Aqui basta pegar o erro de digitação óbvio: o resto
 * quem diz é o provedor, ao recusar.
 */
export function enderecoValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Normaliza para comparar e guardar: e-mail não diferencia caixa. */
export function normalizarEmail(email: string): string {
  const limpo = email.trim().toLowerCase();

  if (!enderecoValido(limpo)) {
    throw new Error('"' + email.trim() + '" não parece um endereço de e-mail.');
  }

  return limpo;
}

/**
 * Esconde o meio do endereço para a tela.
 *
 * O histórico é visto por mais gente do que a lista de contatos;
 * mostrar o endereço inteiro ali vaza contato de fornecedor sem
 * necessidade.
 */
export function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split('@');
  if (!dominio) return '•••';

  const visivel = usuario.slice(0, 2);
  return visivel + '•'.repeat(Math.max(3, usuario.length - 2)) + '@' + dominio;
}

/** O modo de teste está ligado? */
export function modoTeste(): boolean {
  return ambiente.EMAIL_MODO_TESTE !== 'false';
}

/**
 * Confere se o endereço pode receber.
 *
 * Com o modo de teste ligado, só sai para quem está na lista. Sem
 * ele, sai para qualquer endereço — por isso desligar é decisão
 * consciente, feita no .env.
 */
export async function podeEnviarPara(email: string): Promise<boolean> {
  if (!modoTeste()) return true;

  const autorizado = await banco.emailAutorizado.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  return autorizado !== null;
}

async function registrar(dados: {
  para: string;
  pedido: PedidoDeEmail;
  situacao: 'ENVIADA' | 'FALHOU' | 'BLOQUEADA';
  adaptador: string;
  idMensagem?: string;
  erro?: string;
}) {
  return banco.emailEnviado.create({
    data: {
      para: dados.para,
      destino: dados.pedido.destino ?? null,
      assunto: dados.pedido.assunto,
      corpo: dados.pedido.corpo,
      temAnexo: (dados.pedido.anexos?.length ?? 0) > 0,
      situacao: dados.situacao,
      idMensagem: dados.idMensagem ?? null,
      erro: dados.erro ?? null,
      adaptador: dados.adaptador,
      contexto: dados.pedido.contexto ?? null,
      referencia: dados.pedido.referencia ?? null,
      enviadoPorId: dados.pedido.usuarioId ?? null,
    },
  });
}

/**
 * Envia (ou recusa) e SEMPRE registra o que aconteceu.
 *
 * Mesmo o bloqueio vira registro: se alguém tentou mandar para
 * fora da lista, isso precisa aparecer no histórico.
 */
export async function enviarPorEmail(pedido: PedidoDeEmail): Promise<RespostaDeEmail> {
  const adaptador = integracoes.email;

  let endereco: string;
  try {
    endereco = normalizarEmail(pedido.para);
  } catch (erro) {
    const registro = await registrar({
      para: pedido.para.trim(),
      pedido,
      situacao: 'FALHOU',
      adaptador: adaptador.nome,
      erro: erro instanceof Error ? erro.message : 'Endereço inválido.',
    });

    return {
      sucesso: false,
      bloqueado: false,
      mensagem: erro instanceof Error ? erro.message : 'Endereço inválido.',
      registroId: registro.id,
    };
  }

  if (!(await podeEnviarPara(endereco))) {
    const registro = await registrar({
      para: endereco,
      pedido,
      situacao: 'BLOQUEADA',
      adaptador: adaptador.nome,
      erro: 'Endereço fora da lista de autorizados.',
    });

    return {
      sucesso: false,
      bloqueado: true,
      mensagem:
        'O modo de teste está ligado e ' + mascararEmail(endereco) +
        ' não está na lista de autorizados. Nada foi enviado.',
      registroId: registro.id,
    };
  }

  const resultado = await adaptador.enviar({
    para: endereco,
    assunto: pedido.assunto,
    corpo: pedido.corpo,
    anexos: pedido.anexos,
  });

  const registro = await registrar({
    para: endereco,
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
      ? adaptador.nome === 'mock'
        ? 'Modo simulado: o e-mail foi registrado, mas não saiu para fora.'
        : 'E-mail enviado para ' + mascararEmail(endereco) + '.'
      : resultado.erro ?? 'Não foi possível enviar.',
    idMensagem: resultado.idMensagem,
    registroId: registro.id,
  };
}
