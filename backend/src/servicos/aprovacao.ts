// ============================================================
//  Regras da aprovação
//
//  A pergunta central: "esta solicitação já tem assinaturas
//  suficientes para ser aprovada?"
//
//  Duas formas de responder, conforme a faixa de alçada:
//   - exigeTodas = false → uma assinatura basta
//   - exigeTodas = true  → todas as funções precisam assinar
// ============================================================

/**
 * Nome de exibição de cada função.
 *
 * As oito funções do fluxo vêm das migrações e não podem ser
 * apagadas, então o mapa cobre todos os casos reais. Uma função
 * criada depois pela empresa cai no tratamento genérico.
 */
const NOMES: Record<string, string> = {
  SOLICITANTE: 'Solicitante',
  GESTOR_OBRA: 'Gestor de obra',
  COMPRADOR: 'Comprador',
  ENGENHEIRO: 'Engenheiro',
  FUNDADOR: 'Fundador',
  ALMOXARIFE: 'Almoxarife',
  FORNECEDOR: 'Fornecedor',
  ADMINISTRADOR: 'Administrador',
};

/** Transforma GESTOR_OBRA em "Gestor de obra". */
export function nomeDaFuncao(codigo: string): string {
  if (NOMES[codigo]) return NOMES[codigo];

  const limpo = codigo.replace(/_/g, ' ').toLowerCase();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

function listar(codigos: string[]): string {
  return codigos.map(nomeDaFuncao).join(', ');
}

export type Decisao = 'APROVADA' | 'REPROVADA' | 'DEVOLVIDA';

export interface AssinaturaRegistrada {
  funcaoCodigo: string;
  decisao: Decisao;
}

export interface EstadoAprovacao {
  /** Funções que ainda precisam assinar. */
  faltam: string[];
  /** Funções que já aprovaram. */
  assinaram: string[];
  /** Verdadeiro quando já houve reprovação — uma basta. */
  reprovada: boolean;
  /** Verdadeiro quando a solicitação pode virar APROVADA. */
  completa: boolean;
  /** Frase pronta para a tela. Ex: "1 de 2 assinaturas". */
  resumo: string;
}

/**
 * Calcula em que pé está a aprovação.
 *
 * `funcoesExigidas` é a fotografia tirada no momento do envio:
 * se a empresa mudar as faixas de alçada depois, o que já estava
 * em aprovação continua valendo pela regra antiga.
 */
export function calcularEstado(
  funcoesExigidas: string[],
  exigeTodas: boolean,
  assinaturas: AssinaturaRegistrada[],
): EstadoAprovacao {
  const reprovada = assinaturas.some((a) => a.decisao === 'REPROVADA');

  const assinaram = assinaturas
    .filter((a) => a.decisao === 'APROVADA')
    .map((a) => a.funcaoCodigo);

  const faltam = funcoesExigidas.filter((f) => !assinaram.includes(f));

  const completa = reprovada
    ? false
    : exigeTodas
      ? faltam.length === 0 && funcoesExigidas.length > 0
      : assinaram.length > 0;

  let resumo: string;

  if (reprovada) {
    resumo = 'Reprovada.';
  } else if (completa) {
    resumo = 'Todas as assinaturas necessárias foram dadas.';
  } else if (exigeTodas) {
    resumo =
      assinaram.length + ' de ' + funcoesExigidas.length + ' assinaturas. Falta: ' +
      listar(faltam) + '.';
  } else {
    resumo = 'Aguardando a assinatura de uma destas funções: ' + listar(faltam) + '.';
  }

  return { faltam, assinaram, reprovada, completa, resumo };
}

export interface PodeDecidirEntrada {
  /** Situação atual da solicitação. */
  situacao: string;
  /** Funções do usuário que está tentando decidir. */
  funcoesDoUsuario: string[];
  /** Funções exigidas pela faixa de alçada. */
  funcoesExigidas: string[];
  /** Funções que este usuário já assinou nesta solicitação. */
  jaAssinou: string[];
  /** Verdadeiro quando o usuário é o autor da solicitação. */
  ehOAutor: boolean;
}

export type ResultadoPodeDecidir =
  | { pode: true; funcoesDisponiveis: string[] }
  | { pode: false; motivo: string };

/**
 * Confere se a pessoa pode decidir sobre esta solicitação.
 *
 * A trava mais importante: ninguém aprova o próprio pedido, mesmo
 * tendo a função. É o controle básico contra a pessoa comprar para
 * si mesma sem ninguém olhar.
 */
export function podeDecidir(entrada: PodeDecidirEntrada): ResultadoPodeDecidir {
  if (entrada.situacao !== 'AGUARDANDO_APROVACAO') {
    return {
      pode: false,
      motivo: 'Esta solicitação não está aguardando aprovação.',
    };
  }

  if (entrada.ehOAutor) {
    return {
      pode: false,
      motivo: 'Você não pode aprovar uma solicitação que você mesmo abriu.',
    };
  }

  // Funções que a pessoa tem E que a faixa exige E que ela ainda não assinou.
  const disponiveis = entrada.funcoesDoUsuario.filter(
    (f) => entrada.funcoesExigidas.includes(f) && !entrada.jaAssinou.includes(f),
  );

  if (disponiveis.length === 0) {
    const temAlguma = entrada.funcoesDoUsuario.some((f) =>
      entrada.funcoesExigidas.includes(f),
    );

    return {
      pode: false,
      motivo: temAlguma
        ? 'Você já assinou esta solicitação.'
        : 'Esta faixa de valor precisa da assinatura de: ' +
          listar(entrada.funcoesExigidas) + '.',
    };
  }

  return { pode: true, funcoesDisponiveis: disponiveis };
}

/** Situação para onde a solicitação vai depois da decisão. */
export function proximaSituacao(
  decisao: Decisao,
  estadoDepois: EstadoAprovacao,
): 'APROVADA' | 'REPROVADA' | 'EM_REVISAO' | 'AGUARDANDO_APROVACAO' {
  if (decisao === 'REPROVADA') return 'REPROVADA';
  if (decisao === 'DEVOLVIDA') return 'EM_REVISAO';
  return estadoDepois.completa ? 'APROVADA' : 'AGUARDANDO_APROVACAO';
}

/** Texto do evento gravado no histórico. */
export function descreverDecisao(
  decisao: Decisao,
  nomeFuncao: string,
  observacao: string | null | undefined,
  estadoDepois: EstadoAprovacao,
): string {
  const complemento = observacao ? ' Observação: ' + observacao : '';

  switch (decisao) {
    case 'APROVADA':
      return (
        'Aprovada por ' + nomeFuncao + '. ' +
        (estadoDepois.completa
          ? 'Solicitação liberada para cotação.'
          : estadoDepois.resumo) +
        complemento
      );
    case 'REPROVADA':
      return 'Reprovada por ' + nomeFuncao + '.' + complemento;
    case 'DEVOLVIDA':
      return 'Devolvida para revisão por ' + nomeFuncao + '.' + complemento;
  }
}
