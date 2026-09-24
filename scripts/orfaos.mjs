// ============================================================
//  Navegador órfão
//
//  As réguas fecham o navegador direitinho quando terminam. O
//  problema é quando elas NÃO terminam: execução interrompida,
//  tempo esgotado, erro no meio. Aí o Edge fica aberto para
//  sempre, e cada tentativa deixa mais um.
//
//  Medido em 2026-09-23: 47 processos vivos ao mesmo tempo. A
//  máquina ficou tão ocupada que a régua seguinte não conseguiu
//  nem fazer login, e ficou parada sem imprimir uma linha.
//
//  A saída não é lembrar de fechar — é limpar o que ficou ANTES
//  de abrir o próximo. Quem interrompe uma medição raramente
//  está com cabeça de fazer faxina depois.
// ============================================================

import { execSync } from 'node:child_process';

/** O prefixo do perfil, que identifica um navegador nosso. */
export const MARCA_DO_PERFIL = 'portoink-';

/**
 * Mata os navegadores de medições passadas.
 *
 * Melhor esforço: se não der, a medição segue mesmo assim — uma
 * faxina que impede o trabalho é pior que a sujeira.
 */
export function matarOrfaos() {
  if (process.platform !== 'win32') return 0;

  try {
    const comando = [
      'Get-CimInstance Win32_Process -Filter "Name=\'msedge.exe\'"',
      '| Where-Object { $_.CommandLine -like \'*' + MARCA_DO_PERFIL + '*\' }',
      '| ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; 1 } catch { } }',
      '| Measure-Object | Select-Object -ExpandProperty Count',
    ].join(' ');

    const quantos = Number(
      execSync('powershell -NoProfile -Command "' + comando.replace(/"/g, '\\"') + '"', {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 20000,
      }).toString().trim(),
    );

    if (quantos > 0) console.log('  Limpei ' + quantos + ' navegador(es) de medição anterior.');
    return quantos;
  } catch {
    return 0;
  }
}
