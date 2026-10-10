// ============================================================
//  A PROVA DE QUE A MENSAGEM SAIU
//
//  Esta tela existe por uma frase dele, em 10/10/2026:
//
//    "como uma forma de prova que a mensagem foi enviada"
//
//  E a palavra PROVA define o que estes testes protegem:
//
//    1. O BLOQUEIO APARECE. Bloqueio que não aparece em lugar
//       nenhum é bloqueio que ninguém descobre que aconteceu —
//       a garantia que o teste antigo da tela de e-mail dava, e
//       que veio junto quando a lista mudou de casa.
//    2. OS DOIS CANAIS NA MESMA LISTA. WhatsApp e e-mail levam o
//       MESMO convite; separar obriga a perguntar duas vezes.
//    3. TROCAR UM FILTRO VOLTA PARA A PÁGINA 1. A página 4 do
//       filtro anterior quase nunca existe no novo, e cair numa
//       lista vazia parece defeito.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoricoComunicacao } from './HistoricoComunicacao';
import {
  buscarHistoricoDeComunicacao,
  type ItemDoHistorico,
  type PaginaDoHistorico,
} from '../../servicos/historicoComunicacao';

vi.mock('../../servicos/historicoComunicacao', async (original) => ({
  ...(await original<typeof import('../../servicos/historicoComunicacao')>()),
  buscarHistoricoDeComunicacao: vi.fn(),
}));

function item(parcial: Partial<ItemDoHistorico> = {}): ItemDoHistorico {
  return {
    id: 'm1',
    canal: 'whatsapp',
    para: '5583•••••••48',
    destino: null,
    resumo: 'Mensagem de teste do sistema da Porto Inc.',
    temAnexo: false,
    situacao: 'ENVIADA',
    erro: null,
    contexto: 'teste',
    referencia: null,
    quem: 'DEV-Porto',
    quando: '2026-10-10T17:29:22.000Z',
    ...parcial,
  };
}

function pagina(itens: ItemDoHistorico[], extra: Partial<PaginaDoHistorico> = {}) {
  return {
    itens,
    total: itens.length,
    pagina: 1,
    porPagina: 20,
    paginas: 1,
    ...extra,
  };
}

beforeEach(() => {
  vi.mocked(buscarHistoricoDeComunicacao).mockReset().mockResolvedValue(pagina([item()]));
});

describe('A prova de envio', () => {
  it('mostra a tentativa BLOQUEADA, com o motivo', async () => {
    vi.mocked(buscarHistoricoDeComunicacao).mockResolvedValue(
      pagina([
        item({
          id: 'b1',
          situacao: 'BLOQUEADA',
          erro: 'Número fora da lista de autorizados (envio restrito).',
        }),
      ]),
    );

    render(<HistoricoComunicacao />);

    expect(await screen.findByText('Bloqueada')).toBeInTheDocument();
    expect(screen.getByText(/fora da lista de autorizados/)).toBeInTheDocument();
  });

  it('junta os DOIS canais na mesma lista', async () => {
    vi.mocked(buscarHistoricoDeComunicacao).mockResolvedValue(
      pagina([
        item({ id: 'w1', canal: 'whatsapp', contexto: 'cotacao', referencia: 'BID-00005' }),
        item({
          id: 'e1',
          canal: 'email',
          para: 'co••••••@fornecedor.com.br',
          contexto: 'cotacao',
          referencia: 'BID-00005',
        }),
      ]),
    );

    render(<HistoricoComunicacao />);

    expect(await screen.findByText('5583•••••••48')).toBeInTheDocument();
    expect(screen.getByText('co••••••@fornecedor.com.br')).toBeInTheDocument();
    //  E diz de onde partiu, com o número do documento: é por ele
    //  que alguém procura quando o fornecedor liga reclamando.
    expect(screen.getAllByText(/Convite de cotação · BID-00005/).length).toBe(2);
  });

  it('o anexo aparece, porque o pedido vai com PDF', async () => {
    vi.mocked(buscarHistoricoDeComunicacao).mockResolvedValue(
      pagina([item({ contexto: 'pedido', referencia: 'PC-00002', temAnexo: true })]),
    );

    render(<HistoricoComunicacao />);

    expect(await screen.findByText(/com anexo/)).toBeInTheDocument();
  });

  it('vazio não é tela em branco: diz o que vai aparecer ali', async () => {
    vi.mocked(buscarHistoricoDeComunicacao).mockResolvedValue(pagina([]));

    render(<HistoricoComunicacao />);

    expect(await screen.findByText('Nada neste período')).toBeInTheDocument();
  });
});

describe('Os filtros', () => {
  it('trocar o resultado pede a lista de novo, já filtrada', async () => {
    render(<HistoricoComunicacao />);
    await screen.findByText('Enviada');

    await userEvent.selectOptions(screen.getByLabelText('Resultado'), 'BLOQUEADA');

    expect(buscarHistoricoDeComunicacao).toHaveBeenLastCalledWith(
      expect.objectContaining({ situacao: 'BLOQUEADA' }),
    );
  });

  it('trocar um filtro VOLTA para a primeira página', async () => {
    //  Sem isto, quem estava na página 4 e filtra cai numa lista
    //  vazia — que parece defeito, e não é.
    vi.mocked(buscarHistoricoDeComunicacao).mockResolvedValue(
      pagina([item()], { pagina: 4, total: 90, paginas: 5 }),
    );

    render(<HistoricoComunicacao />);
    await screen.findByText('Enviada');

    await userEvent.selectOptions(screen.getByLabelText('Canal'), 'email');

    expect(buscarHistoricoDeComunicacao).toHaveBeenLastCalledWith(
      expect.objectContaining({ canal: 'email', pagina: 1 }),
    );
  });

  it('o período começa nos últimos 30 dias, não em tudo', async () => {
    //  "Desde o começo" numa empresa com dois anos de uso traz
    //  milhares de linhas para responder uma pergunta de ontem.
    render(<HistoricoComunicacao />);
    await screen.findByText('Enviada');

    expect(buscarHistoricoDeComunicacao).toHaveBeenCalledWith(
      expect.objectContaining({ dias: 30 }),
    );
  });
});
