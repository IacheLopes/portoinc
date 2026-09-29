// ============================================================
//  Dados de demonstração - APENAS DESENVOLVIMENTO
//
//  Cria obras, famílias, materiais e fornecedores fictícios para
//  que as telas de cadastro possam ser validadas com conteúdo
//  realista, sem precisar digitar tudo à mão.
//
//  Recusa-se a rodar quando NODE_ENV=production.
// ============================================================

import { PrismaClient } from '@prisma/client';

const banco = new PrismaClient();

const FAMILIAS = [
  { codigo: 'CIM', nome: 'Cimento e argamassas', descricao: 'Cimento, cal, argamassa e rejunte.' },
  { codigo: 'AGR', nome: 'Agregados', descricao: 'Areia, brita, pedrisco e pó de pedra.' },
  { codigo: 'ACO', nome: 'Aço e ferragens', descricao: 'Vergalhão, arame recozido e tela soldada.' },
  { codigo: 'ELE', nome: 'Material elétrico', descricao: 'Fios, cabos, eletrodutos, quadros e disjuntores.' },
  { codigo: 'HID', nome: 'Material hidráulico', descricao: 'Tubos, conexões, registros e louças.' },
  { codigo: 'REV', nome: 'Revestimentos', descricao: 'Pisos, azulejos, porcelanatos e rodapés.' },
  { codigo: 'PIN', nome: 'Tintas e vedação', descricao: 'Tintas, massa corrida, selador e silicone.' },
  { codigo: 'EPI', nome: 'EPI e segurança', descricao: 'Capacete, luva, bota, óculos e cinto.' },
  { codigo: 'LOC', nome: 'Locação de equipamentos', descricao: 'Betoneira, andaime, compactador e gerador.' },
  { codigo: 'SER', nome: 'Serviços de terceiros', descricao: 'Mão de obra especializada e empreitada.' },
];

const MATERIAIS = [
  { familia: 'CIM', codigo: '00119', descricao: 'Cimento Portland CP-II-Z-32 saco 50kg', marca: 'Votoran', gtin: '7899888400575', norma: 'NBR 16697', unidade: 'SC', ponto: 50, linha: '03.01.001' },
  { familia: 'CIM', codigo: '00206', descricao: 'Argamassa colante AC-II saco 20kg', marca: 'Quartzolit', gtin: '7896193243897', norma: 'NBR 14081', unidade: 'SC', ponto: 30, linha: '07.02.001' },
  { familia: 'CIM', codigo: '00207', descricao: 'Cal hidratada CH-III saco 20kg', marca: 'Itaú', gtin: '7898494150676', norma: 'NBR 7175', unidade: 'SC', ponto: 20, linha: '03.01.002' },
  { familia: 'AGR', codigo: '00210', descricao: 'Areia média lavada', marca: null, gtin: null, norma: 'NBR 7211', unidade: 'M3', ponto: 10, linha: '03.02.001' },
  { familia: 'AGR', codigo: '00211', descricao: 'Brita 1', marca: null, gtin: null, norma: 'NBR 7211', unidade: 'M3', ponto: 10, linha: '03.02.002' },
  { familia: 'ACO', codigo: '00046', descricao: 'Vergalhão CA-50 10mm barra 12m', marca: 'Gerdau', gtin: null, norma: 'NBR 7480', unidade: 'UN', ponto: 100, linha: '04.01.001' },
  { familia: 'ACO', codigo: '00068', descricao: 'Arame recozido n. 18 rolo 1kg', marca: null, gtin: null, norma: 'NBR 5589', unidade: 'KG', ponto: 25, linha: '04.01.002' },
  { familia: 'ELE', codigo: '00087', descricao: 'Cabo flexível 2,5mm2 750V rolo 100m', marca: 'Sil', gtin: null, norma: 'NBR NM 247-3', unidade: 'RL', ponto: 8, linha: '09.01.001' },
  { familia: 'ELE', codigo: '00088', descricao: 'Eletroduto PVC flexível 3/4" rolo 50m', marca: 'Tigre', gtin: null, norma: 'NBR 15465', unidade: 'RL', ponto: 6, linha: '09.01.002' },
  { familia: 'ELE', codigo: '00089', descricao: 'Disjuntor monopolar 20A curva C', marca: 'Steck', gtin: null, norma: 'NBR NM 60898', unidade: 'UN', ponto: 20, linha: '09.02.001' },
  { familia: 'HID', codigo: '00028', descricao: 'Tubo PVC soldável 25mm barra 6m', marca: 'Tigre', gtin: null, norma: 'NBR 5648', unidade: 'UN', ponto: 40, linha: '08.01.001' },
  { familia: 'HID', codigo: '00201', descricao: 'Registro de gaveta 3/4" bruto', marca: 'Docol', gtin: null, norma: 'NBR 15705', unidade: 'UN', ponto: 15, linha: '08.02.001' },
  { familia: 'REV', codigo: '00204', descricao: 'Porcelanato acetinado 60x60cm caixa 2,16m2', marca: 'Portobello', gtin: null, norma: 'NBR 13818', unidade: 'CX', ponto: 20, linha: '07.03.001' },
  { familia: 'PIN', codigo: '00130', descricao: 'Tinta acrílica fosca branca lata 18L', marca: 'Suvinil', gtin: null, norma: 'NBR 11702', unidade: 'LT', ponto: 6, linha: '11.01.001' },
  { familia: 'EPI', codigo: '00131', descricao: 'Capacete de segurança classe B com jugular', marca: '3M', gtin: null, norma: 'NBR 8221', unidade: 'UN', ponto: 30, linha: '01.03.001' },
  { familia: 'EPI', codigo: '00134', descricao: 'Luva de raspa cano curto par', marca: null, gtin: null, norma: 'NBR 13712', unidade: 'PAR', ponto: 40, linha: '01.03.002' },
];

const SERVICOS = [
  { familia: 'SER', codigo: 'S0001', descricao: 'Execução de alvenaria de vedação', unidade: 'M2', linha: '05.01.001' },
  { familia: 'SER', codigo: 'S0002', descricao: 'Instalação elétrica completa por ponto', unidade: 'UN', linha: '09.03.001' },
  { familia: 'LOC', codigo: 'L0001', descricao: 'Locação de betoneira 400L', unidade: 'DIA', linha: '01.02.001' },
  { familia: 'LOC', codigo: 'L0002', descricao: 'Locação de andaime tubular metro linear', unidade: 'M', linha: '01.02.002' },
];

// OS TELEFONES SAO IMPOSSIVEIS DE PROPOSITO.
//
// O DDD 00 nao existe no Brasil, entao estes numeros nao podem
// chegar em pessoa nenhuma. Antes eram numeros de Sao Paulo com
// formato valido — e alguem e dono deles.
//
// Isso e a ULTIMA linha de defesa, nao a primeira: a trava de
// verdade e a lista de autorizados. Mas em 29/09/2026 tres rotas
// pulavam essa trava, e se o WhatsApp estivesse ligado naquele
// dia a mensagem teria saido. Numero impossivel e o cinto de
// seguranca para quando o freio falha.
const FORNECEDORES = [
  { razao: 'Marquilip Comércio e Representação Ltda', fantasia: 'Marquilip', cnpj: '19131243000197', cidade: 'São Paulo', uf: 'SP', email: 'vendas@marquilip.com.br', whatsapp: '550090000001', familias: ['CIM', 'AGR', 'ACO'] },
  { razao: 'Eletrosul Materiais Elétricos Ltda', fantasia: 'Eletrosul', cnpj: '05570714000159', cidade: 'Guarulhos', uf: 'SP', email: 'comercial@eletrosul.com.br', whatsapp: '550090000002', familias: ['ELE'] },
  { razao: 'Hidromax Distribuidora de Materiais Ltda', fantasia: 'Hidromax', cnpj: '33000167000101', cidade: 'Osasco', uf: 'SP', email: 'pedidos@hidromax.com.br', whatsapp: '550090000003', familias: ['HID', 'REV'] },
  { razao: 'Constrular Depósito de Materiais Ltda', fantasia: 'Constrular', cnpj: '47960950000121', cidade: 'São Paulo', uf: 'SP', email: 'atendimento@constrular.com.br', whatsapp: '550090000004', familias: ['CIM', 'AGR', 'PIN', 'REV'] },
  { razao: 'Segurança Total EPI Comércio Ltda', fantasia: 'Segurança Total', cnpj: '60746948000112', cidade: 'Barueri', uf: 'SP', email: 'vendas@segurancatotal.com.br', whatsapp: '550090000005', familias: ['EPI'] },
  { razao: 'LocaMaq Locação de Equipamentos Ltda', fantasia: 'LocaMaq', cnpj: '02558157000162', cidade: 'São Paulo', uf: 'SP', email: 'locacao@locamaq.com.br', whatsapp: '550090000006', familias: ['LOC'] },
];

const OBRAS = [
  { codigo: 'OB-001', nome: 'Residencial Porto Belo', cliente: 'Porto Inc. Incorporações', cidade: 'São Paulo', uf: 'SP', situacao: 'EM_ANDAMENTO' as const },
  { codigo: 'OB-002', nome: 'Edifício Vista Mar', cliente: 'Condomínio Vista Mar', cidade: 'Santos', uf: 'SP', situacao: 'EM_ANDAMENTO' as const },
  { codigo: 'OB-003', nome: 'Galpão Logístico Anhanguera', cliente: 'TransLog S.A.', cidade: 'Cajamar', uf: 'SP', situacao: 'PLANEJAMENTO' as const },
];

/** Orçamento simplificado aplicado à primeira obra. */
const ORCAMENTO = [
  { codigo: '01.02.001', descricao: 'Locação de betoneira', unidade: 'DIA', qtd: 180, valor: 65 },
  { codigo: '01.02.002', descricao: 'Locação de andaime', unidade: 'M', valor: 12, qtd: 400 },
  { codigo: '01.03.001', descricao: 'EPI - capacetes', unidade: 'UN', qtd: 60, valor: 28 },
  { codigo: '01.03.002', descricao: 'EPI - luvas', unidade: 'PAR', qtd: 200, valor: 14 },
  { codigo: '03.01.001', descricao: 'Cimento Portland', unidade: 'SC', qtd: 1200, valor: 34 },
  { codigo: '03.01.002', descricao: 'Cal hidratada', unidade: 'SC', qtd: 300, valor: 22 },
  { codigo: '03.02.001', descricao: 'Areia média', unidade: 'M3', qtd: 180, valor: 130 },
  { codigo: '03.02.002', descricao: 'Brita 1', unidade: 'M3', qtd: 150, valor: 145 },
  { codigo: '04.01.001', descricao: 'Aço CA-50', unidade: 'UN', qtd: 900, valor: 58 },
  { codigo: '04.01.002', descricao: 'Arame recozido', unidade: 'KG', qtd: 250, valor: 26 },
  { codigo: '05.01.001', descricao: 'Alvenaria de vedação', unidade: 'M2', qtd: 2400, valor: 96 },
  { codigo: '07.02.001', descricao: 'Argamassa colante', unidade: 'SC', qtd: 420, valor: 31 },
  { codigo: '07.03.001', descricao: 'Porcelanato', unidade: 'CX', qtd: 560, valor: 118 },
  { codigo: '08.01.001', descricao: 'Tubulação PVC', unidade: 'UN', qtd: 700, valor: 24 },
  { codigo: '08.02.001', descricao: 'Registros e metais', unidade: 'UN', qtd: 120, valor: 89 },
  { codigo: '09.01.001', descricao: 'Cabos elétricos', unidade: 'RL', qtd: 45, valor: 390 },
  { codigo: '09.01.002', descricao: 'Eletrodutos', unidade: 'RL', qtd: 40, valor: 98 },
  { codigo: '09.02.001', descricao: 'Disjuntores', unidade: 'UN', qtd: 150, valor: 32 },
  { codigo: '09.03.001', descricao: 'Instalação elétrica por ponto', unidade: 'UN', qtd: 480, valor: 74 },
  { codigo: '11.01.001', descricao: 'Pintura acrílica', unidade: 'LT', qtd: 90, valor: 285 },
];

async function principal() {
  if (process.env.NODE_ENV === 'production') {
    console.log('  [cadastros] Produção: dados de demonstração NÃO serão criados.');
    return;
  }

  if ((await banco.familiaMaterial.count()) > 0) {
    console.log('  [cadastros] Dados de demonstração já existem. Nada a fazer.');
    return;
  }

  // ---------- Famílias ----------
  for (const f of FAMILIAS) {
    await banco.familiaMaterial.create({ data: f });
  }

  const familias = await banco.familiaMaterial.findMany();
  const idDaFamilia = new Map(familias.map((f) => [f.codigo, f.id]));

  // ---------- Materiais ----------
  for (const m of MATERIAIS) {
    await banco.material.create({
      data: {
        familiaId: idDaFamilia.get(m.familia)!,
        codigoInterno: m.codigo,
        descricao: m.descricao,
        tipo: 'MATERIAL',
        marca: m.marca ?? undefined,
        gtin: m.gtin ?? undefined,
        normaTecnica: m.norma,
        unidadeMedida: m.unidade,
        pontoPedido: m.ponto,
        codigoLinhaPadrao: m.linha,
      },
    });
  }

  // ---------- Serviços e locações ----------
  for (const s of SERVICOS) {
    await banco.material.create({
      data: {
        familiaId: idDaFamilia.get(s.familia)!,
        codigoInterno: s.codigo,
        descricao: s.descricao,
        tipo: 'SERVICO',
        unidadeMedida: s.unidade,
        codigoLinhaPadrao: s.linha,
      },
    });
  }

  // ---------- Fornecedores ----------
  for (const f of FORNECEDORES) {
    await banco.fornecedor.create({
      data: {
        razaoSocial: f.razao,
        nomeFantasia: f.fantasia,
        cnpj: f.cnpj,
        cidade: f.cidade,
        uf: f.uf,
        email: f.email,
        whatsapp: f.whatsapp,
        familias: {
          create: f.familias.map((codigo) => ({ familiaId: idDaFamilia.get(codigo)! })),
        },
        contatos: {
          create: {
            nome: 'Central de Vendas',
            cargo: 'Atendimento',
            email: f.email,
            whatsapp: f.whatsapp,
            principal: true,
          },
        },
      },
    });
  }

  // ---------- Obras e almoxarifados ----------
  for (const o of OBRAS) {
    await banco.obra.create({
      data: {
        ...o,
        dataInicio: new Date('2026-02-01'),
        almoxarifados: {
          create: { codigo: o.codigo + '-ALM', nome: 'Almoxarifado ' + o.nome },
        },
      },
    });
  }

  // Almoxarifado central da empresa (sem obra vinculada).
  await banco.almoxarifado.create({
    data: { codigo: 'CENTRAL', nome: 'Almoxarifado Central', central: true },
  });

  // ---------- Orçamento da primeira obra ----------
  const primeira = await banco.obra.findUnique({ where: { codigo: 'OB-001' } });

  if (primeira) {
    await banco.linhaOrcamento.createMany({
      data: ORCAMENTO.map((l, indice) => ({
        obraId: primeira.id,
        codigo: l.codigo,
        descricao: l.descricao,
        unidade: l.unidade,
        quantidadePrevista: l.qtd,
        valorUnitarioPrevisto: l.valor,
        ordem: indice + 1,
      })),
    });
  }

  const total = ORCAMENTO.reduce((soma, l) => soma + l.qtd * l.valor, 0);

  console.log('');
  console.log('  [cadastros] Demonstração criada:');
  console.log('    ' + FAMILIAS.length + ' famílias');
  console.log('    ' + (MATERIAIS.length + SERVICOS.length) + ' itens de catálogo');
  console.log('    ' + FORNECEDORES.length + ' fornecedores');
  console.log('    ' + OBRAS.length + ' obras + almoxarifado central');
  console.log('    ' + ORCAMENTO.length + ' linhas de orçamento (R$ ' + total.toLocaleString('pt-BR') + ')');
  console.log('');
}

principal()
  .catch((erro) => {
    console.error('  [cadastros] Falhou:', erro);
    process.exit(1);
  })
  .finally(() => banco.$disconnect());
