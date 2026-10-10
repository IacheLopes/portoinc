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
 * Quanto tempo um navegador pode estar vivo sem ser órfão.
 *
 * Uma varredura das 41 telas leva uns 15 minutos. Enquanto ela
 * roda, os navegadores dela estão TRABALHANDO — e carregam a
 * mesma marca de perfil dos que ficaram para trás, porque a marca
 * identifica o projeto, não a execução.
 */
const MINUTOS_PARA_SER_ORFAO = 25;

/**
 * Mata os navegadores de medições passadas.
 *
 * NÃO MATA O QUE AINDA ESTÁ MEDINDO.
 *
 * Em 10/10/2026 eu rodei a régua numa tela só enquanto a varredura
 * das 41 estava no ar. A faxina da segunda matou os navegadores da
 * primeira, que travou na tela 31 e ficou pendurada sem dizer por
 * quê — o sintoma apareceu longe da causa, como sempre.
 *
 * A marca do perfil diz "este navegador é do PortoInk"; ela não
 * diz de qual execução. O que separa um órfão de um trabalhador é
 * a IDADE: medição viva tem minutos, órfã tem horas.
 *
 * Melhor esforço: se não der, a medição segue mesmo assim — uma
 * faxina que impede o trabalho é pior que a sujeira.
 */
export function matarOrfaos() {
  if (process.platform !== 'win32') return 0;

  try {
    const comando = [
      '$corte = (Get-Date).AddMinutes(-' + MINUTOS_PARA_SER_ORFAO + ');',
      'Get-CimInstance Win32_Process -Filter "Name=\'msedge.exe\'"',
      '| Where-Object { $_.CommandLine -like \'*' + MARCA_DO_PERFIL + '*\' -and $_.CreationDate -lt $corte }',
      '| ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; 1 } catch { } }',
      '| Measure-Object | Select-Object -ExpandProperty Count',
    ].join(' ');

    const quantos = Number(
      execSync('powershell -NoProfile -Command "' + comando.replace(/"/g, '\\"') + '"', {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 20000,
      }).toString().trim(),
    );

    if (quantos > 0) {
      console.log('  Limpei ' + quantos + ' navegador(es) parado(s) há mais de '
        + MINUTOS_PARA_SER_ORFAO + ' minutos.');
    }
    return quantos;
  } catch {
    return 0;
  }
}
