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
 * O MESMO texto, em HTML.
 *
 * Não é uma segunda mensagem: é a mesma, para o e-mail sair em
 * `multipart/alternative`. Mensagem só-texto é minoria no mundo
 * real, e filtro de spam pontua o que é incomum.
 *
 * Deliberadamente simples. Um modelo com logotipo, tabela e botão
 * colorido pesa MAIS contra a entrega do que a falta de HTML: é o
 * desenho do e-mail promocional, e é o que os filtros aprenderam a
 * olhar com desconfiança. Aqui é uma fonte legível, o texto que a
 * pessoa já receberia, e os links clicáveis.
 *
 * `escapar()` vem antes de tudo: o corpo carrega nome de
 * fornecedor e título de cotação, que são texto digitado por
 * gente. Um `<` solto quebraria a mensagem no cliente de e-mail.
 */
export function htmlDoTexto(texto: string): string {
  const escapar = (t: string) =>
    t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  //  Os links viram clicáveis. O texto puro já os mostra inteiros;
  //  aqui eles ganham o `<a>` — e o endereço continua visível, em
  //  vez de virar "clique aqui". Link escondido atrás de texto é
  //  outro padrão que conta contra a entrega.
  const comLinks = escapar(texto).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#1a5f9e">$1</a>',
  );

  //  Parágrafo por linha em branco, quebra simples dentro deles.
  const paragrafos = comLinks
    .split(/\n{2,}/)
    .map((p) => '<p style="margin:0 0 16px">' + p.replace(/\n/g, '<br>') + '</p>')
    .join('');

  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:24px;background:#f5f5f5">' +
    '<div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff;' +
    'border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;' +
    'line-height:1.6;color:#222222">' +
    paragrafos +
    '</div></body></html>'
  );
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
/*
 *  A TRAVA DE TESTE DO E-MAIL SAIU EM 12/10/2026.
 *
 *  Havia aqui `modoTeste()` e `podeEnviarPara()`: com a trava
 *  ligada, só saía e-mail para endereços de uma lista.
 *
 *  O WhatsApp MANTÉM a dele, e a diferença é real: lá, depois de
 *  ler o QR, o sistema está pronto para disparar para qualquer
 *  número do cadastro — a lista é a forma rápida de testar sem
 *  alcançar fornecedor de verdade.
 *
 *  No e-mail o freio é outro e já existe: nada sai enquanto
 *  ninguém cadastrar um remetente pela tela, o que é ato
 *  deliberado. E para conferir basta o envio de teste, que aceita
 *  qualquer destinatário.
 *
 *  Desligada, a trava virava um formulário na tela que não fazia
 *  nada — e o texto dele falava de uma restrição inexistente.
 */

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

  const resultado = await adaptador.enviar({
    para: endereco,
    assunto: pedido.assunto,
    corpo: pedido.corpo,
    //  A VERSÃO HTML NASCE AQUI, e não em cada tela.
    //
    //  É o mesmo motivo de esta função existir: há uma porta só.
    //  Gerar o HTML aqui dá a parte HTML ao convite de cotação, ao
    //  pedido de compra, ao link de senha e ao teste de envio de
    //  uma vez — sem reescrever quatro corpos de mensagem e sem
    //  deixar um deles para trás.
    corpoHtml: htmlDoTexto(pedido.corpo),
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
        ? 'O e-mail foi registrado, mas ainda não sai do sistema.'
        : 'E-mail enviado para ' + mascararEmail(endereco) + '.'
      : resultado.erro ?? 'Não foi possível enviar.',
    idMensagem: resultado.idMensagem,
    registroId: registro.id,
  };
}
