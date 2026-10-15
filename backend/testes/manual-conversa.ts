// ============================================================
//  PROVA DE BANCADA da conversa de dois turnos
//
//  A pergunta que isto responde: ela lembra do que acabou de
//  dizer? Sem memoria, "quer a lista?" seguido de "sim" vira
//  silencio — e e justamente ai que um assistente deixa de
//  parecer gente.
//
//  Rode com:
//    docker compose exec api npx tsx testes/manual-conversa.ts
// ============================================================

import { responder } from '../src/servicos/assistente.js';
import type { TurnoIA } from '../src/integracoes/ia/porta.js';
import type { QuemPergunta } from '../src/servicos/assistente-ferramentas.js';

const quem: QuemPergunta = { tipo: 'equipe', usuarioId: 'prova', nome: 'Leonardo' };

async function principal() {
  const conversa: TurnoIA[] = [];

  for (const fala of ['boa tarde', 'me fala dos fornecedores', 'sim, manda a lista', 'e quantas obras?']) {
    const r = await responder(fala, quem, conversa);

    console.log('\n  EU:   ' + fala);
    console.log('  ELA:  ' + r.texto.split('\n').join('\n        '));
    console.log('        [consultou: ' + (r.consultas.map((c) => c.nome).join(', ') || 'nada') + ']');

    conversa.push({ papel: 'pessoa', texto: fala });
    conversa.push({ papel: 'assistente', texto: r.texto });
  }
}

principal()
  .catch((e) => console.error('  FALHOU: ' + (e as Error).message))
  .finally(() => process.exit());
