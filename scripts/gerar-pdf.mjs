// ============================================================
//  Gerador de PDF - Porto Inc.
//
//  Converte um arquivo Markdown em PDF com a identidade visual
//  da empresa, usando o Microsoft Edge para imprimir.
//
//  Uso:
//    node gerar-pdf.mjs tutorial
//    node gerar-pdf.mjs guia-testes
// ============================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const executar = promisify(execFile);
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

// ------------------------------------------------------------
//  Documentos que sabemos gerar
// ------------------------------------------------------------
const DOCUMENTOS = {
  tutorial: {
    entrada: join(RAIZ, 'docs', 'tutorial', 'TUTORIAL.md'),
    saida: join(RAIZ, 'docs', 'tutorial', 'Tutorial-PortoInc.pdf'),
    titulo: 'Manual do Sistema<br/>de Compras e Almoxarifado',
    subtitulo: 'Guia de uso passo a passo',
    aviso:
      'Este manual é atualizado a cada etapa de construção do sistema. ' +
      'Funções marcadas como <strong>em construção</strong> ainda não estão disponíveis.',
  },
  'guia-testes': {
    entrada: join(RAIZ, 'docs', 'testes', 'GUIA-TESTE-MANUAL.md'),
    saida: join(RAIZ, 'docs', 'testes', 'Guia-Teste-Manual-PortoInc.pdf'),
    titulo: 'Guia de Teste Manual',
    subtitulo: 'Roteiro de validação do sistema',
    aviso:
      'Marque cada caso como <strong>OK</strong> ou <strong>FALHOU</strong> conforme testar. ' +
      'Os casos são acrescentados a cada etapa concluída.',
  },
};

const CAMINHOS_EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function acharEdge() {
  const achado = CAMINHOS_EDGE.find((c) => existsSync(c));
  if (!achado) {
    throw new Error(
      'Microsoft Edge não encontrado. O PDF é gerado por ele.\n' +
      'Procurado em:\n  ' + CAMINHOS_EDGE.join('\n  '),
    );
  }
  return achado;
}

const ESTILO = `
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }

  :root {
    --marinho: #0f2942;
    --azul: #2f6fed;
    --texto: #16202b;
    --suave: #5a6b7d;
    --borda: #dde4ec;
    --fundo-suave: #f7f9fb;
    --verde: #1f8a4c;
  }

  * { box-sizing: border-box; }

  body {
    font-family: 'Segoe UI', system-ui, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.6;
    color: var(--texto);
    margin: 0;
  }

  /* ---------- Capa ---------- */
  .capa {
    height: 247mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    page-break-after: always;
    border-left: 6px solid var(--azul);
    padding-left: 14mm;
  }
  .capa__marca { font-size: 30pt; font-weight: 700; color: var(--marinho); letter-spacing: -1px; }
  .capa__marca span { color: var(--azul); }
  .capa__titulo { font-size: 24pt; font-weight: 600; color: var(--marinho); margin-top: 14mm; }
  .capa__sub { font-size: 12pt; color: var(--suave); margin-top: 4mm; }
  .capa__meta { margin-top: 20mm; font-size: 9.5pt; color: var(--suave); }
  .capa__aviso {
    margin-top: 8mm; padding: 4mm 5mm; background: var(--fundo-suave);
    border-left: 3px solid var(--azul); font-size: 9pt; color: var(--suave); max-width: 120mm;
  }

  /* ---------- Títulos ---------- */
  h1 {
    font-size: 17pt; color: var(--marinho); margin: 0 0 6mm;
    padding-bottom: 3mm; border-bottom: 2px solid var(--azul);
    page-break-before: always; page-break-after: avoid;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 { font-size: 13pt; color: var(--marinho); margin: 8mm 0 3mm; page-break-after: avoid; }
  h3 { font-size: 11pt; color: var(--marinho); margin: 6mm 0 2mm; page-break-after: avoid; }

  p { margin: 0 0 3mm; }
  ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
  li { margin-bottom: 1.5mm; }
  strong { color: var(--marinho); }

  /* ---------- Tabelas ---------- */
  table {
    width: 100%; border-collapse: collapse; margin: 3mm 0 5mm;
    font-size: 9.5pt; page-break-inside: avoid;
  }
  th {
    background: var(--marinho); color: #fff; text-align: left;
    padding: 2.5mm 3mm; font-weight: 600; font-size: 9pt;
  }
  td { padding: 2.5mm 3mm; border-bottom: 1px solid var(--borda); vertical-align: top; }
  tr:nth-child(even) td { background: var(--fundo-suave); }

  /* ---------- Código ---------- */
  code {
    font-family: 'Cascadia Code', Consolas, monospace;
    font-size: 9pt; background: #eef2f6; padding: 0.5mm 1.5mm;
    border-radius: 2px; color: #0a1c2e;
  }
  pre {
    background: var(--marinho); color: #eaf1f8; padding: 4mm;
    border-radius: 3mm; overflow-x: auto; font-size: 8.5pt;
    line-height: 1.5; page-break-inside: avoid;
  }
  pre code { background: none; color: inherit; padding: 0; }

  /* ---------- Destaque ---------- */
  blockquote {
    margin: 4mm 0; padding: 3mm 4mm; background: var(--fundo-suave);
    border-left: 3px solid var(--azul); color: var(--suave);
    page-break-inside: avoid;
  }
  blockquote p:last-child { margin-bottom: 0; }

  hr { border: none; border-top: 1px solid var(--borda); margin: 6mm 0; }
  a { color: var(--azul); text-decoration: none; }

  /* ---------- Específico do guia de testes ---------- */
  /* Cada caso de teste não pode ser cortado entre páginas. */
  h3 + table, h3 + p + table { page-break-inside: avoid; }

  /* Caixinhas para marcar no papel. */
  .marcar { letter-spacing: 1mm; font-size: 13pt; color: var(--suave); }
`;

function montarCapa(doc, versao, data) {
  return `
  <div class="capa">
    <div class="capa__marca">Porto Inc<span>.</span></div>
    <div class="capa__titulo">${doc.titulo}</div>
    <div class="capa__sub">${doc.subtitulo}</div>
    <div class="capa__meta">
      Versão do documento: <strong>${versao}</strong><br/>
      Atualizado em: <strong>${data}</strong>
    </div>
    <div class="capa__aviso">${doc.aviso}</div>
  </div>`;
}

async function principal() {
  const nome = process.argv[2] ?? 'tutorial';
  const doc = DOCUMENTOS[nome];

  if (!doc) {
    throw new Error(
      'Documento desconhecido: "' + nome + '".\n' +
      'Disponíveis: ' + Object.keys(DOCUMENTOS).join(', '),
    );
  }

  if (!existsSync(doc.entrada)) {
    throw new Error('Arquivo não encontrado: ' + doc.entrada);
  }

  const markdown = await readFile(doc.entrada, 'utf8');
  const versao = markdown.match(/<!--\s*versao:\s*([^\s]+)\s*-->/)?.[1] ?? '0.1.0';
  const data = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const corpo = await marked.parse(markdown);
  const htmlTemp = doc.saida.replace(/\.pdf$/, '.html');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Porto Inc.</title>
  <style>${ESTILO}</style>
</head>
<body>
${montarCapa(doc, versao, data)}
${corpo}
</body>
</html>`;

  await mkdir(dirname(htmlTemp), { recursive: true });
  await writeFile(htmlTemp, html, 'utf8');

  await executar(
    acharEdge(),
    [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--print-to-pdf=' + doc.saida,
      'file:///' + htmlTemp.replace(/\\/g, '/'),
    ],
    { timeout: 120000 },
  );

  console.log('');
  console.log('  PDF gerado: ' + nome);
  console.log('  Versão: ' + versao);
  console.log('  Arquivo: ' + doc.saida);
  console.log('');
}

principal().catch((erro) => {
  console.error('\n  [ERRO] Não foi possível gerar o PDF:\n  ' + erro.message + '\n');
  process.exit(1);
});
