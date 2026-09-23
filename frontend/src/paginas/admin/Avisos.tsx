// ============================================================
//  Avisos ao fornecedor
//
//  WhatsApp e e-mail fazem o MESMO trabalho: levar o convite de
//  cotação e o pedido de compra até o fornecedor. Têm a mesma
//  trava (lista de autorizados) e o mesmo histórico.
//
//  Por isso ficam numa tela só, em duas abas. Duas telas quase
//  iguais no menu obrigariam a pessoa a lembrar em qual delas
//  estava a coisa que ela procura — e o bloco Administração já
//  tem quatro itens, que é o limite em que o olho ainda bate a
//  vista sem contar.
//
//  A aba escolhida vai para o endereço (?ver=email): recarregar
//  a página não joga a pessoa de volta para a primeira aba.
// ============================================================

import { useSearchParams } from 'react-router-dom';
import { ConfiguracaoWhatsApp } from './WhatsApp';
import { ConfiguracaoEmail } from './Email';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';

const ABAS = [
  {
    chave: 'whatsapp',
    rotulo: 'WhatsApp',
    intro:
      'Conectar um número para o sistema enviar convites de cotação e pedidos de compra ' +
      'sem sair da tela.',
  },
  {
    chave: 'email',
    rotulo: 'E-mail',
    intro:
      'O mesmo convite e o mesmo pedido, pelo e-mail do fornecedor. O pedido vai com o ' +
      'PDF em anexo.',
  },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

function ehAba(valor: string | null): valor is Aba {
  return ABAS.some((a) => a.chave === valor);
}

export function Avisos() {
  const [parametros, setParametros] = useSearchParams();

  const pedida = parametros.get('ver');
  const aba: Aba = ehAba(pedida) ? pedida : 'whatsapp';
  const atual = ABAS.find((a) => a.chave === aba)!;

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Avisos ao fornecedor"
          descricao={
            <>
              Como o convite de cotação e o pedido de compra chegam até quem vai vender.
            </>
          }
        />

        <div className="abas" role="tablist" aria-label="Canais de aviso">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              type="button"
              role="tab"
              id={'aba-' + a.chave}
              aria-selected={a.chave === aba}
              aria-controls={'painel-' + a.chave}
              className={'aba' + (a.chave === aba ? ' aba--ativa' : '')}
              onClick={() => setParametros({ ver: a.chave })}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={'painel-' + aba}
          aria-labelledby={'aba-' + aba}
          className="aba__conteudo"
        >
          <p className="aba__pergunta">{atual.intro}</p>
        </div>
      </section>

      {aba === 'whatsapp' && <ConfiguracaoWhatsApp />}
      {aba === 'email' && <ConfiguracaoEmail />}
    </>
  );
}
