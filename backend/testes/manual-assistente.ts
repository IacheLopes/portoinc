// ============================================================
//  PROVA DE BANCADA do assistente
//
//  Faz as perguntas de verdade, contra o banco de verdade e a
//  Groq de verdade, e imprime o que ele responderia. Não é teste
//  automático de propósito: modelo de linguagem não responde
//  igual duas vezes, e um teste assim quebraria sozinho na
//  terça-feira seguinte sem ninguém ter mexido em nada.
//
//  Serve para OLHAR. A mecânica é testada com o adaptador
//  simulado, em `assistente.test.ts`.
//
//  Rode com:
//    docker compose exec api npx tsx testes/manual-assistente.ts
//    docker compose exec api npx tsx testes/manual-assistente.ts "sua pergunta"
// ============================================================

import { responder, identificar } from '../src/servicos/assistente.js';
import { integracoes } from '../src/integracoes/index.js';
import type { QuemPergunta } from '../src/servicos/assistente-ferramentas.js';

const PERGUNTAS = [
  'Como estão as coisas?',
  'Tem alguma cotação aberta?',
  'O fornecedor Marquilip já respondeu a cotação BID-00001?',
  'Algum fornecedor abriu o link e não respondeu?',
  'A equalização da BID-00001 já foi feita?',
  'Quem são os compradores do sistema?',
  'Quantos fornecedores atendem material elétrico?',
  'Tem alguma coisa esperando aprovação? Quem precisa assinar?',
  'Tem algum pedido que ainda não foi enviado ao fornecedor?',
  'Tem conta vencida?',
];

async function principal() {
  const pergunta = process.argv[2];
  const lista = pergunta ? [pergunta] : PERGUNTAS;

  console.log('\n  Adaptador: ' + integracoes.ia.nome);
  console.log('  Pronto: ' + integracoes.ia.pronto());

  //  Quem pergunta: equipe, para a prova cobrir o alcance maior.
  //  Trocar aqui por `fornecedor` mostra o recorte do outro lado.
  const quem: QuemPergunta = { tipo: 'equipe', usuarioId: 'prova', nome: 'Leonardo' };

  let tokens = 0;

  for (const p of lista) {
    const comeco = Date.now();
    const r = await responder(p, quem);
    tokens += r.tokens.entrada + r.tokens.saida;

    console.log('\n' + '─'.repeat(64));
    console.log('  PERGUNTA: ' + p);
    console.log('  consultou: ' + (r.consultas.map((c) => c.nome).join(', ') || 'nada'));
    console.log('  ' + (Date.now() - comeco) + 'ms · ' + (r.tokens.entrada + r.tokens.saida) + ' tokens' +
      (r.querUmaPessoa ? ' · PEDIU HUMANO' : ''));
    console.log('\n' + r.texto.split('\n').map((l) => '  | ' + l).join('\n'));
  }

  console.log('\n' + '─'.repeat(64));
  console.log('  Modelo: ' + integracoes.ia.modelo());
  console.log('  Total: ' + tokens + ' tokens em ' + lista.length + ' perguntas');

  //  Conferindo o reconhecimento de número, que é o que decide
  //  quem vê o quê.
  if (!pergunta) {
    console.log('\n  QUEM É QUEM:');
    for (const n of ['5583993952248', '558393952248', '550090000001', '5511999999999']) {
      const q = await identificar(n);
      console.log('    ' + n + ' -> ' + q.tipo + ' (' + q.nome + ')');
    }
  }
}

principal()
  .catch((e) => {
    console.error('  FALHOU: ' + (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
