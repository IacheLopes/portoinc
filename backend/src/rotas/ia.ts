// ============================================================
//  ÁREA IA — o cérebro do assistente, pela tela
//
//  Tudo que molda o assistente mora aqui e não no código: o NOME
//  por que ele atende, as instruções que ajudam ele a pensar, o
//  modelo, os grupos liberados e as chaves de ligar.
//
//  É ferramenta INTERNA: só quem administra integrações entra.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { banco } from '../plugins/banco.js';
import { integracoes } from '../integracoes/index.js';
import { erroDeValidacao, textoOpcional } from '../servicos/util.js';
import {
  cerebro, recarregar, salvar, chaveMascarada,
} from '../servicos/configuracao-ia.js';
import { responder, identificar } from '../servicos/assistente.js';
import { chamaramPeloNome } from '../servicos/atendimento.js';

const esquemaCerebro = z.object({
  //  O nome é o GATILHO no grupo. Uma letra só acordaria o
  //  assistente em metade das frases; vinte não cabem numa
  //  conversa. Dois a vinte é o que sobra de útil.
  nome: z.string().trim().min(2, 'O nome precisa de ao menos 2 letras.').max(20).optional(),
  instrucoes: textoOpcional(4000),
  modelo: z.string().trim().max(120).nullable().optional(),
  chave: z.string().trim().min(10).optional(),
  ativo: z.boolean().optional(),
  responderNoPrivado: z.boolean().optional(),
  exigirNomeEmGrupo: z.boolean().optional(),
  transcreverAudio: z.boolean().optional(),
  //  Zero = sem limite. Ver o comentario em `atendimento.ts`.
  limitePorHora: z.number().int().min(0).max(500).optional(),
});

const esquemaPergunta = z.object({
  pergunta: z.string().trim().min(2).max(1000),
});

export async function rotasIA(app: FastifyInstance) {
  // --------------------------------------------------------
  //  O estado do cérebro
  // --------------------------------------------------------
  app.get(
    '/api/ia/situacao',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      const c = cerebro();
      const porta = integracoes.ia;

      return {
        nome: c.nome,
        instrucoes: c.instrucoes,
        modelo: porta.modelo(),
        modeloEscolhido: c.modelo,
        //  A CHAVE VOLTA MASCARADA, SEMPRE. Ela entra, nunca sai.
        chaveMascarada: chaveMascarada(c.chave),
        temChave: Boolean(c.chave),
        adaptador: porta.nome,
        simulado: porta.nome === 'mock',
        pronto: porta.pronto(),
        ativo: c.ativo,
        responderNoPrivado: c.responderNoPrivado,
        exigirNomeEmGrupo: c.exigirNomeEmGrupo,
        transcreverAudio: c.transcreverAudio,
        limitePorHora: c.limitePorHora,
        confirmadoEm: c.confirmadoEm,
        atualizadoEm: c.atualizadoEm,
      };
    },
  );

  // --------------------------------------------------------
  //  ESTÁ TUDO PRONTO PARA ELE FUNCIONAR?
  //
  //  São SEIS condições, e elas estavam espalhadas pela tela.
  //  Quem chegava não sabia qual faltava — e em 14/10/2026 isso
  //  custou duas rodadas de teste: uma por falta de telefone
  //  cadastrado, outra porque "responder sozinho" tinha ficado
  //  desligada de um conserto anterior.
  //
  //  Aqui elas viram uma lista, com o que fazer em cada uma.
  // --------------------------------------------------------
  app.get(
    '/api/ia/diagnostico',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      const c = cerebro();
      const whats = integracoes.whatsapp.situacao();

      const [grupos, comTelefone] = await Promise.all([
        banco.grupoWhatsApp.count({ where: { liberado: true } }),
        banco.usuario.count({ where: { ativo: true, telefone: { not: null } } }),
      ]);

      const itens = [
        {
          chave: 'whatsapp',
          titulo: 'WhatsApp conectado',
          ok: whats.estado === 'conectado',
          falta: 'Leia o QR em Comunicação → WhatsApp. Quem atende é o número que ler.',
        },
        {
          chave: 'chave',
          titulo: 'Chave da IA cadastrada',
          ok: integracoes.ia.pronto(),
          falta: 'Cadastre a chave do provedor no campo acima.',
        },
        {
          chave: 'ativo',
          titulo: 'Assistente ligado',
          ok: c.ativo,
          falta: 'Clique em "Ligar o assistente".',
        },
        {
          chave: 'grupo',
          titulo: 'Pelo menos um grupo escolhido',
          ok: grupos > 0,
          falta: 'Busque os grupos do WhatsApp e adicione um. Sem grupo, ele só atende no privado.',
        },
        {
          chave: 'telefone',
          titulo: 'Alguém com telefone cadastrado',
          ok: comTelefone > 0,
          falta:
            'Preencha o telefone das pessoas em Administração → Usuários. ' +
            'É por ele que o assistente reconhece a equipe no privado.',
        },
      ];

      return {
        pronto: itens.every((i) => i.ok),
        //  Grupo e telefone não impedem o funcionamento em si: dá
        //  para ter um sem o outro. Mas sem NENHUM dos dois ele
        //  nunca vai falar com ninguém.
        itens,
      };
    },
  );

  // --------------------------------------------------------
  //  Os modelos que a conta tem
  // --------------------------------------------------------
  app.get(
    '/api/ia/modelos',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      //  LIDOS DA CONTA, não escritos no código. Em 14/10/2026 o
      //  catálogo da Groq não tinha mais o Llama 3.3 que toda a
      //  internet manda usar — lista chumbada envelhece sozinha.
      const porta = integracoes.ia as { modelosDisponiveis?: () => Promise<string[]> };

      const modelos =
        typeof porta.modelosDisponiveis === 'function' ? await porta.modelosDisponiveis() : [];

      return { modelos };
    },
  );

  // --------------------------------------------------------
  //  Salvar o cérebro
  // --------------------------------------------------------
  app.patch(
    '/api/ia/cerebro',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const dados = esquemaCerebro.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      const c = await salvar({ ...dados.data, quem: req.usuario!.nome });

      return {
        mensagem: 'Configuração salva.',
        situacao: {
          nome: c.nome,
          ativo: c.ativo,
          temChave: Boolean(c.chave),
          chaveMascarada: chaveMascarada(c.chave),
          modelo: integracoes.ia.modelo(),
        },
      };
    },
  );

  // --------------------------------------------------------
  //  Ligar, provando
  // --------------------------------------------------------
  app.post(
    '/api/ia/ligar',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const dados = esquemaCerebro.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      //  "SALVAR" SERIA MENTIRA GENTIL — a mesma lição do e-mail.
      //  Chave errada salva em silêncio quebra o assistente em
      //  silêncio, e a empresa descobre quando alguém pergunta no
      //  grupo e ninguém responde. Aqui ligamos E perguntamos.
      //  LIGAR É LIGAR.
      //
      //  Eram duas chaves para a mesma pergunta, e isso virou
      //  armadilha em 14/10/2026: ele clicou em "Ligar o
      //  assistente", mandou mensagem e nada saiu — porque
      //  "Responder sozinho" tinha ficado desligada de um conserto
      //  anterior, e a resposta foi parar em rascunho.
      //
      //  Quem clica em LIGAR quer que ele responda. O modo
      //  rascunho continua existindo, mas passa a ser uma escolha
      //  feita DEPOIS, na chave, e não um estado em que se cai sem
      //  perceber.
      await salvar({
        ...dados.data,
        ativo: true,
        quem: req.usuario!.nome,
      });

      if (!integracoes.ia.pronto()) {
        await salvar({ ativo: false });
        return res.status(400).send({
          erro: 'A chave não foi aceita: o assistente continua desligado.',
        });
      }

      try {
        const prova = await integracoes.ia.responder({
          sistema: 'Responda em uma frase curta, em português, confirmando que está no ar.',
          conversa: [{ papel: 'pessoa', texto: 'Você está funcionando?' }],
          //  FOLGA DE PROPÓSITO. Este modelo gasta tokens
          //  "pensando" antes de escrever, e com teto de 20 a
          //  prova voltava com texto VAZIO — parecia defeito e era
          //  só aperto. A prova precisa caber inteira.
          limiteDeSaida: 300,
        });

        await salvar({ confirmadoEm: new Date() });
        await recarregar();

        return {
          mensagem: 'Assistente ligado. O modelo respondeu.',
          modelo: prova.modelo,
          resposta: prova.texto,
        };
      } catch (erro) {
        //  Desliga de volta: melhor "não ligou" do que um
        //  assistente que a tela diz estar no ar e está mudo.
        await salvar({ ativo: false });

        return res.status(502).send({
          erro: erro instanceof Error ? erro.message : 'O provedor não respondeu.',
        });
      }
    },
  );

  app.post(
    '/api/ia/desligar',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req) => {
      await salvar({ ativo: false, quem: req.usuario!.nome });
      return { mensagem: 'Assistente desligado. Ele não responde mais no WhatsApp.' };
    },
  );

  // --------------------------------------------------------
  //  Perguntar ali mesmo, sem WhatsApp
  // --------------------------------------------------------
  app.post(
    '/api/ia/perguntar',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const dados = esquemaPergunta.safeParse(req.body);
      if (!dados.success) return res.status(400).send(erroDeValidacao(dados.error));

      if (!integracoes.ia.pronto()) {
        return res.status(400).send({ erro: 'O assistente ainda não está configurado.' });
      }

      //  Quem pergunta pela tela JÁ ESTÁ AUTENTICADO, e com
      //  permissão de integrações: é equipe por definição. Não
      //  precisa do telefone cadastrado para testar aqui — e é
      //  justamente por isso que esta caixa existe.
      const r = await responder(dados.data.pergunta, {
        tipo: 'equipe',
        usuarioId: req.usuario!.id,
        nome: req.usuario!.nome,
      });

      return {
        resposta: r.texto,
        consultas: r.consultas.map((x) => x.nome),
        querUmaPessoa: r.querUmaPessoa,
        modelo: r.modelo,
        tokens: r.tokens.entrada + r.tokens.saida,
      };
    },
  );

  // --------------------------------------------------------
  //  Os grupos
  // --------------------------------------------------------
  app.get(
    '/api/ia/grupos',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      //  SÓ OS ESCOLHIDOS. A lista deixou de se encher sozinha em
      //  14/10/2026: num celular pessoal, ela vinha trazendo o
      //  grupo da família e o das ofertas para dentro da tela da
      //  empresa.
      const grupos = await banco.grupoWhatsApp.findMany({ orderBy: { nome: 'asc' } });

      return {
        grupos: grupos.map((g) => ({
          id: g.id,
          nome: g.nome,
          liberado: g.liberado,
          vistoEm: g.vistoEm,
          liberadoEm: g.liberadoEm,
        })),
      };
    },
  );

  // --------------------------------------------------------
  //  Os grupos que o WhatsApp conhece, para escolher
  // --------------------------------------------------------
  app.get(
    '/api/ia/grupos-disponiveis',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async () => {
      const whatsapp = integracoes.whatsapp;

      if (typeof whatsapp.listarGrupos !== 'function') return { grupos: [], conectado: false };

      const [todos, jaEscolhidos] = await Promise.all([
        whatsapp.listarGrupos(),
        banco.grupoWhatsApp.findMany({ select: { jid: true } }),
      ]);

      const dentro = new Set(jaEscolhidos.map((g) => g.jid));

      return {
        //  O que já está na lista sai das opções: oferecer de novo
        //  só serviria para alguém adicionar duas vezes.
        grupos: todos.filter((g) => !dentro.has(g.jid)),
        conectado: todos.length > 0,
      };
    },
  );

  // --------------------------------------------------------
  //  Adicionar um grupo
  // --------------------------------------------------------
  app.post(
    '/api/ia/grupos',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const corpo = z
        .object({ jid: z.string().trim().min(5).endsWith('@g.us') })
        .safeParse(req.body);

      if (!corpo.success) return res.status(400).send(erroDeValidacao(corpo.error));

      const whatsapp = integracoes.whatsapp;

      //  O NOME VEM DO WHATSAPP, não da tela. Deixar a pessoa
      //  digitar abriria espaço para a lista dizer "Obra" e o
      //  assistente responder noutro lugar.
      const disponiveis =
        typeof whatsapp.listarGrupos === 'function' ? await whatsapp.listarGrupos() : [];

      const achado = disponiveis.find((g) => g.jid === corpo.data.jid);

      if (!achado) {
        return res.status(404).send({
          erro: 'Esse grupo não aparece no WhatsApp conectado. Atualize a lista e tente de novo.',
        });
      }

      const grupo = await banco.grupoWhatsApp.upsert({
        where: { jid: achado.jid },
        create: {
          jid: achado.jid,
          nome: achado.nome,
          //  Entra JÁ LIBERADO: escolher o grupo na lista é o ato
          //  consciente. Pedir dois cliques para a mesma decisão
          //  só faria alguém esquecer o segundo.
          liberado: true,
          liberadoEm: new Date(),
          liberadoPor: req.usuario!.nome,
        },
        update: {
          nome: achado.nome,
          liberado: true,
          liberadoEm: new Date(),
          liberadoPor: req.usuario!.nome,
        },
      });

      return {
        mensagem:
          'Pronto. No grupo "' + (grupo.nome ?? 'sem nome') +
          '" ele responde quando o chamarem pelo nome.',
        grupo: { id: grupo.id, nome: grupo.nome, liberado: grupo.liberado },
      };
    },
  );

  // --------------------------------------------------------
  //  Tirar um grupo
  // --------------------------------------------------------
  app.delete(
    '/api/ia/grupos/:id',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const { id } = req.params as { id: string };

      const existe = await banco.grupoWhatsApp.findUnique({ where: { id } });
      if (!existe) return res.status(404).send({ erro: 'Grupo não encontrado.' });

      //  SAI DA TABELA, não fica desligado. Grupo que ninguém quer
      //  mais não precisa continuar registrado — e a lista volta a
      //  ser só o que está valendo.
      await banco.grupoWhatsApp.delete({ where: { id } });

      return { mensagem: 'O assistente não responde mais nesse grupo.' };
    },
  );

  app.patch(
    '/api/ia/grupos/:id',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const { id } = req.params as { id: string };
      const corpo = z.object({ liberado: z.boolean() }).safeParse(req.body);
      if (!corpo.success) return res.status(400).send(erroDeValidacao(corpo.error));

      const existe = await banco.grupoWhatsApp.findUnique({ where: { id } });
      if (!existe) return res.status(404).send({ erro: 'Grupo não encontrado.' });

      const grupo = await banco.grupoWhatsApp.update({
        where: { id },
        data: {
          liberado: corpo.data.liberado,
          liberadoEm: corpo.data.liberado ? new Date() : null,
          liberadoPor: corpo.data.liberado ? req.usuario!.nome : null,
        },
      });

      return {
        mensagem: grupo.liberado
          ? 'O assistente passa a responder neste grupo quando o chamarem pelo nome.'
          : 'O assistente não responde mais neste grupo.',
        grupo: { id: grupo.id, nome: grupo.nome, liberado: grupo.liberado },
      };
    },
  );

  // --------------------------------------------------------
  //  As conversas
  // --------------------------------------------------------
  app.get(
    '/api/ia/conversas',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req) => {
      const { limite } = req.query as { limite?: string };

      const lista = await banco.mensagemEnviada.findMany({
        where: { contexto: 'assistente' },
        orderBy: { criadoEm: 'desc' },
        take: Math.min(Number(limite) || 60, 200),
      });

      return {
        conversas: lista.map((m) => ({
          id: m.id,
          direcao: m.direcao,
          //  O NÚMERO NUNCA APARECE INTEIRO, a mesma regra do
          //  histórico de WhatsApp e do de e-mail.
          numeroMascarado:
            m.numero.length > 6
              ? m.numero.slice(0, 4) + '•'.repeat(m.numero.length - 6) + m.numero.slice(-2)
              : m.numero,
          deQuem: m.destino,
          texto: m.texto,
          situacao: m.situacao,
          erro: m.erro,
          modelo: m.modeloIa,
          //  A TRILHA: é por aqui que se descobre se a resposta
          //  veio do banco ou saiu da cabeça dele.
          consultas: m.consultasIa,
          tokens: m.tokensIa,
          ehGrupo: Boolean(m.referencia?.endsWith('@g.us')),
          criadoEm: m.criadoEm,
        })),
      };
    },
  );

  // --------------------------------------------------------
  //  Conferir o gatilho sem mandar mensagem
  // --------------------------------------------------------
  app.post(
    '/api/ia/testar-nome',
    { preHandler: app.exigirPermissao('sistema.integracoes') },
    async (req, res) => {
      const corpo = z.object({ frase: z.string().max(500) }).safeParse(req.body);
      if (!corpo.success) return res.status(400).send(erroDeValidacao(corpo.error));

      return {
        nome: cerebro().nome,
        chamaria: chamaramPeloNome(corpo.data.frase, cerebro().nome),
      };
    },
  );
}
