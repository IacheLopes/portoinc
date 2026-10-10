// ============================================================
//  Tela de e-mail
//
//  O risco desta tela é alguém mandar e-mail para um fornecedor
//  de verdade achando que estava testando. Por isso o que se
//  testa aqui é, antes de tudo, o AVISO e a trava.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfiguracaoEmail } from './Email';
import {
  buscarSituacaoEmail, listarEmailsAutorizados, listarHistoricoDeEmail, enviarEmailDeTeste,
  type SituacaoEmail, type EmailAutorizado, type EmailDoHistorico,
} from '../../servicos/email';

vi.mock('../../servicos/email', async (original) => ({
  ...(await original<typeof import('../../servicos/email')>()),
  buscarSituacaoEmail: vi.fn(),
  listarEmailsAutorizados: vi.fn(),
  listarHistoricoDeEmail: vi.fn(),
  enviarEmailDeTeste: vi.fn(),
  autorizarEmail: vi.fn(),
  removerEmailAutorizado: vi.fn(),
}));

const SIMULADO: SituacaoEmail = {
  adaptador: 'mock',
  simulado: true,
  pronto: true,
  remetente: 'simulado@portoinc.local',
  modoTeste: true,
  detalhe: 'Modo simulado: nada sai para fora. Os e-mails ficam registrados aqui.',
};

const AUTORIZADO: EmailAutorizado = {
  id: 'a1',
  email: 'fornecedor@exemplo.com.br',
  emailMascarado: 'fo••••••••@exemplo.com.br',
  nome: 'Fornecedor de teste',
  observacao: null,
  criadoPor: 'Administrador',
  criadoEm: '2026-09-23T10:00:00.000Z',
};

const BLOQUEADO: EmailDoHistorico = {
  id: 'h1',
  emailMascarado: 'ou••••@outro.com.br',
  destino: null,
  assunto: 'Porto Inc. — teste de envio',
  corpo: 'teste',
  temAnexo: false,
  situacao: 'BLOQUEADA',
  erro: 'Endereço fora da lista de autorizados.',
  adaptador: 'mock',
  contexto: 'teste',
  referencia: null,
  enviadoPor: 'Administrador',
  criadoEm: '2026-09-23T10:05:00.000Z',
};

function montar() {
  render(<ConfiguracaoEmail />);
  return userEvent.setup();
}

beforeEach(() => {
  vi.mocked(buscarSituacaoEmail).mockReset().mockResolvedValue(SIMULADO);
  vi.mocked(listarEmailsAutorizados).mockReset().mockResolvedValue({
    modoTeste: true,
    autorizados: [AUTORIZADO],
  });
  vi.mocked(listarHistoricoDeEmail).mockReset().mockResolvedValue({ historico: [BLOQUEADO] });
  vi.mocked(enviarEmailDeTeste).mockReset();
});

describe('O aviso do topo', () => {
  it('diz com todas as letras que nada sai para fora', async () => {
    montar();

    //  "Modo simulado" era palavra de quem constrói. A frase diz a
    //  mesma verdade na língua de quem administra.
    expect(
      await screen.findByText(/Nenhum e-mail sai do sistema ainda/),
    ).toBeInTheDocument();
  });

  it('quando o provedor está ligado, o aviso MUDA de tom', async () => {
    // Este é o aviso que separa "testando" de "mandei para o
    // fornecedor". Ele não pode continuar igual.
    vi.mocked(buscarSituacaoEmail).mockResolvedValue({
      ...SIMULADO,
      adaptador: 'resend',
      simulado: false,
      detalhe: 'Ligado no provedor de verdade.',
    });

    montar();

    expect(await screen.findByText(/o e-mail SAI/)).toBeInTheDocument();
    expect(screen.queryByText(/não sai do sistema ainda/)).not.toBeInTheDocument();
  });

  it('explica a lista de autorizados enquanto o modo de teste está ligado', async () => {
    montar();

    expect(await screen.findByText(/só os endereços da lista/)).toBeInTheDocument();
  });
});

describe('A lista de autorizados', () => {
  it('mostra o endereço MASCARADO, não o endereço inteiro', async () => {
    montar();

    expect(await screen.findByText('fo••••••••@exemplo.com.br')).toBeInTheDocument();
    expect(screen.queryByText('fornecedor@exemplo.com.br')).not.toBeInTheDocument();
  });
});

describe('O envio de teste', () => {
  it('fica travado enquanto não houver um destinatário', async () => {
    montar();

    expect(await screen.findByRole('button', { name: /enviar teste/i })).toBeDisabled();
  });

  it('libera depois de digitar o endereço', async () => {
    const usuario = montar();

    await usuario.type(await screen.findByLabelText(/^para/i), 'eu@empresa.com.br');

    expect(screen.getByRole('button', { name: /enviar teste/i })).toBeEnabled();
  });
});

describe('O histórico', () => {
  it('mostra a tentativa BLOQUEADA, não só o que foi enviado', async () => {
    // Bloqueio que não aparece em lugar nenhum é bloqueio que
    // ninguém descobre que aconteceu.
    montar();

    expect(await screen.findByText('Bloqueada')).toBeInTheDocument();
    expect(screen.getByText(/fora da lista de autorizados/)).toBeInTheDocument();
  });
});
