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

describe('O cartão de estado', () => {
  //  Era um aviso em caixa; virou cartão, com a mesma forma da
  //  aba do WhatsApp. As duas fazem o mesmo trabalho e passaram
  //  meses com desenhos diferentes.

  it('diz com todas as letras que nada sai para fora', async () => {
    montar();

    expect(await screen.findByText('Não sai ainda')).toBeInTheDocument();
    expect(
      screen.getByText(/ficam registrados, sem chegar a ninguém/),
    ).toBeInTheDocument();
  });

  it('e diz O QUE FALTA, não só que falta', async () => {
    //  "Não está pronto" sem dizer o que fazer é só frustração.
    //  O adaptador de verdade já existe e funciona: o que falta é
    //  a empresa ter domínio, conta no provedor e DNS.
    montar();

    expect(await screen.findByText(/Domínio da empresa/)).toBeInTheDocument();
    expect(screen.getByText(/Conta no provedor/)).toBeInTheDocument();
    expect(screen.getByText(/SPF e DKIM/)).toBeInTheDocument();
    expect(screen.getByText(/cai no spam/)).toBeInTheDocument();
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

    expect(await screen.findByText('Pronto')).toBeInTheDocument();
    expect(screen.getByText(/Sai de/)).toBeInTheDocument();
    expect(screen.queryByText('Não sai ainda')).not.toBeInTheDocument();

    //  E some a lista do que falta: nao falta mais nada.
    expect(screen.queryByText(/SPF e DKIM/)).not.toBeInTheDocument();
  });

  it('a lista de autorizados se explica na própria seção', async () => {
    //  A frase sobre a restrição saiu do cartão de estado: com o
    //  adaptador simulado NADA sai, e falar de restrição ali
    //  sugere que a restrição é o que está segurando — quando o
    //  que segura é não haver provedor nenhum.
    montar();

    expect(
      await screen.findByText(/só estes endereços recebem e-mail/),
    ).toBeInTheDocument();
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

//  O HISTÓRICO MUDOU DE CASA, E O TESTE FOI JUNTO.
//
//  Ele vivia aqui, mostrando só o e-mail. Desde 10/10/2026 mora
//  na aba "Mensagens enviadas", junto com o do WhatsApp — os dois
//  canais levam o MESMO convite, e quem pergunta "o BID-00005
//  saiu?" não quer perguntar duas vezes.
//
//  A garantia que este teste dava — "bloqueio que não aparece em
//  lugar nenhum é bloqueio que ninguém descobre" — continua
//  coberta, em `HistoricoComunicacao.test.tsx`.
