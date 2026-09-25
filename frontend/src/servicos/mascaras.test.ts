// ============================================================
//  As máscaras
//
//  O que mais importa aqui não é a pontuação bonita — é o telefone
//  guardado do jeito certo. O dono escreveu "(083) 99839-2849" ao
//  pedir a máscara, com o zero de discagem. Guardado assim, o número
//  vira 083... e o WhatsApp procura um contato que não existe.
//
//  Esse erro não apareceria em teste nenhum e nem na tela: apareceria
//  no dia de ligar a integração, meses depois, como "a mensagem não
//  chega para esse fornecedor".
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  soDigitos, mascaraCnpj, mascaraCpf, mascaraTelefone,
  parteNacional, telefoneParaGuardar, telefoneCompleto, mascaraChaveAcesso,
} from './mascaras';

describe('CNPJ', () => {
  it('pontua conforme se digita', () => {
    expect(mascaraCnpj('19')).toBe('19');
    expect(mascaraCnpj('19131')).toBe('19.131');
    expect(mascaraCnpj('19131243')).toBe('19.131.243');
    expect(mascaraCnpj('191312430001')).toBe('19.131.243/0001');
    expect(mascaraCnpj('19131243000197')).toBe('19.131.243/0001-97');
  });

  it('para nos catorze dígitos', () => {
    // O que passa disso é tecla batida sem querer.
    expect(mascaraCnpj('1913124300019799999')).toBe('19.131.243/0001-97');
  });

  it('aceita o que já vem pontuado, sem duplicar ponto', () => {
    expect(mascaraCnpj('19.131.243/0001-97')).toBe('19.131.243/0001-97');
  });
});

describe('CPF', () => {
  it('pontua e para nos onze dígitos', () => {
    expect(mascaraCpf('12345678909')).toBe('123.456.789-09');
    expect(mascaraCpf('123456789099999')).toBe('123.456.789-09');
  });
});

describe('Telefone', () => {
  it('celular de nove dígitos', () => {
    expect(mascaraTelefone('83998392849')).toBe('(83) 99839-2849');
  });

  it('fixo de oito dígitos', () => {
    expect(mascaraTelefone('8332215566')).toBe('(83) 3221-5566');
  });

  it('o zero de discagem NÃO vira DDD de três dígitos', () => {
    // Foi como o dono escreveu ao pedir: "(083) 99839-2849".
    // O zero é prefixo de operadora — guardado, quebra o WhatsApp.
    expect(mascaraTelefone('083998392849')).not.toContain('(083)');
  });

  it('guarda com o 55 na frente', () => {
    expect(telefoneParaGuardar('(83) 99839-2849')).toBe('5583998392849');
  });

  it('não põe 55 em campo vazio', () => {
    // Senão um fornecedor sem telefone ficaria com "55" gravado, e a
    // integração tentaria mandar mensagem para o país inteiro.
    expect(telefoneParaGuardar('')).toBe('');
    expect(telefoneCompleto('')).toBe('');
  });

  it('não dobra o 55 ao reabrir um cadastro', () => {
    // O valor volta do banco já com o DDI. Sem esta proteção viraria
    // 555583998392849 a cada vez que alguém abrisse e salvasse.
    expect(telefoneParaGuardar('5583998392849')).toBe('5583998392849');
    expect(parteNacional('5583998392849')).toBe('83998392849');
  });

  it('mostra inteiro para tela e para documento', () => {
    expect(telefoneCompleto('5583998392849')).toBe('+55 (83) 99839-2849');
  });

  it('um DDD que começa com 55 continua inteiro', () => {
    // Não existe DDD 55 seguido de 10 dígitos, mas a regra tem de
    // olhar o TAMANHO e não só o começo. 5511944443333 tem 13 e é
    // DDI+DDD; 5591234567 tem 10 e é DDD 55 com fixo.
    expect(parteNacional('5532215566')).toBe('5532215566');
  });
});

describe('Chave de acesso da nota', () => {
  it('quebra em grupos de quatro', () => {
    const chave = '3'.repeat(44);
    const saida = mascaraChaveAcesso(chave);

    expect(saida.split(' ')).toHaveLength(11);
    expect(soDigitos(saida)).toBe(chave);
  });

  it('para nos 44 dígitos', () => {
    expect(soDigitos(mascaraChaveAcesso('9'.repeat(60)))).toHaveLength(44);
  });
});
