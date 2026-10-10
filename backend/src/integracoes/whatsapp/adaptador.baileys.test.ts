// ============================================================
//  A RETOMADA SOZINHA DA SESSÃO
//
//  Pedido dele em 10/10/2026:
//
//    "durante o suporte que vamos prestar no futuro, toda vez
//     que formos subir alguma atualização na produção ele vai
//     cair, então é necessário que ele reconecte sozinho"
//
//  O que este arquivo protege é a TRAVA, não a retomada: o
//  adaptador só pode retomar o que JÁ foi autorizado por uma
//  pessoa. Sem sessão salva, ele não pode fazer nada — e em
//  especial não pode gerar QR.
//
//  QR nascendo sozinho num servidor é um convite aberto esperando
//  leitor, numa tela que ninguém está olhando.
//
//  A conexão em si não se testa aqui: depende do WhatsApp do
//  outro lado. O que dá para cravar é a decisão de tentar.
// ============================================================

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AdaptadorWhatsAppBaileys, mascarar, normalizarTelefone } from './adaptador.baileys.js';

let pasta = '';

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), 'portoink-sessao-'));
});

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true });
});

describe('Retomar a sessão quando a API sobe', () => {
  it('SEM sessão salva, não faz nada — nem gera QR', async () => {
    const adaptador = new AdaptadorWhatsAppBaileys(pasta);

    await adaptador.retomarSessao();

    assert.equal(adaptador.estado(), 'desconectado', 'não pode sair do lugar sozinho');
    assert.equal(
      adaptador.situacao().temQr,
      false,
      'servidor não pode gerar QR por conta própria',
    );
  });

  it('e não inventa pasta de sessão só para olhar', async () => {
    const vazia = join(pasta, 'nunca-existiu');
    const adaptador = new AdaptadorWhatsAppBaileys(vazia);

    await adaptador.retomarSessao();

    assert.equal(existsSync(vazia), false);
    assert.equal(adaptador.estado(), 'desconectado');
  });

  it('reconhece que HÁ sessão salva quando o creds.json existe', () => {
    const adaptador = new AdaptadorWhatsAppBaileys(pasta);
    assert.equal(adaptador.temSessaoSalva(), false);

    writeFileSync(join(pasta, 'creds.json'), '{}');
    assert.equal(adaptador.temSessaoSalva(), true);
  });

  it('avisa o diário a cada mudança de estado', () => {
    //  É por este aviso que o diário existe. Se ele parar de
    //  disparar, a tela de conexão volta a não ter memória e
    //  ninguém percebe — não quebra nada visível.
    const anotados: string[] = [];
    const adaptador = new AdaptadorWhatsAppBaileys(pasta, (estado) => {
      anotados.push(estado);
    });

    //  `desconectar` passa por estados mesmo sem nunca ter
    //  conectado, que é o caminho mais barato de provocar uma
    //  mudança sem subir socket nenhum.
    void adaptador.desconectar();

    assert.ok(anotados.length > 0, 'o diário precisa ser avisado');
  });
});

describe('O número na tela', () => {
  it('mostra DDI, DDD e os dois últimos, e esconde o resto', () => {
    assert.equal(mascarar('5583999994448'), '5583•••••••48');
    assert.equal(mascarar(null), '—');
  });

  it('o telefone vira só dígitos', () => {
    assert.equal(normalizarTelefone('+55 (83) 99999-4448'), '5583999994448');
  });
});
