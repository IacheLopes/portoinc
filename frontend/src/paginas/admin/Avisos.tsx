// ============================================================
//  Comunicação
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
//
//  O RESUMO EM CIMA, E POR QUE ELE EXISTE
//
//  Antes, saber se o WhatsApp estava conectado exigia abrir a aba
//  do WhatsApp; saber do e-mail, abrir a outra. Quem chega aqui
//  quer exatamente isto: o convite sai ou não sai? Agora os dois
//  estados aparecem juntos, antes das abas.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfiguracaoWhatsApp } from './WhatsApp';
import { ConfiguracaoEmail } from './Email';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Selo, type TipoSelo } from '../../componentes/Selo';
import { buscarSituacao, type SituacaoWhatsApp } from '../../servicos/whatsapp';
import { buscarSituacaoEmail, type SituacaoEmail } from '../../servicos/email';

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

/** Como o estado de um canal se lê em português. */
interface Leitura {
  tipo: TipoSelo;
  texto: string;
  detalhe: string;
}

function lerWhatsApp(s: SituacaoWhatsApp | null): Leitura {
  if (!s) return { tipo: 'info', texto: 'Conferindo', detalhe: '' };
  if (s.estado === 'conectado') {
    return {
      tipo: 'sucesso',
      texto: 'Conectado',
      detalhe: s.numero
        ? 'Pelo número ' + s.numero
        : 'Pronto para enviar convite e pedido',
    };
  }
  return {
    tipo: 'atencao',
    texto: 'Não conectado',
    detalhe: 'Nenhuma mensagem sai enquanto não houver um número conectado',
  };
}

function lerEmail(s: SituacaoEmail | null): Leitura {
  if (!s) return { tipo: 'info', texto: 'Conferindo', detalhe: '' };

  //  "PRONTO" TEM DE QUERER DIZER QUE O E-MAIL CHEGA.
  //
  //  A primeira versão disto olhava só `pronto`, que quer dizer
  //  "tem remetente configurado" — e dizia PRONTO com o adaptador
  //  simulado, onde nada sai. Um resumo que mente para o lado
  //  otimista é pior do que resumo nenhum: quem lesse mandaria o
  //  pedido e iria embora achando que o fornecedor recebeu.
  if (s.simulado) {
    return {
      tipo: 'atencao',
      texto: 'Não sai ainda',
      detalhe: 'Os e-mails ficam registrados no histórico, sem chegar a ninguém',
    };
  }

  if (s.pronto) {
    return {
      tipo: 'sucesso',
      texto: 'Pronto',
      detalhe: s.remetente ? 'Sai de ' + s.remetente : 'Pronto para enviar',
    };
  }

  return {
    tipo: 'atencao',
    texto: 'Não configurado',
    detalhe: 'Nenhum e-mail sai enquanto não houver um remetente configurado',
  };
}

export function Avisos() {
  const [parametros, setParametros] = useSearchParams();
  const [whatsapp, setWhatsapp] = useState<SituacaoWhatsApp | null>(null);
  const [email, setEmail] = useState<SituacaoEmail | null>(null);

  const pedida = parametros.get('ver');
  const aba: Aba = ehAba(pedida) ? pedida : 'whatsapp';
  const atual = ABAS.find((a) => a.chave === aba)!;

  //  O resumo não pode derrubar a tela: se um dos dois não
  //  responder, o outro ainda aparece e as abas continuam
  //  funcionando, que é onde a configuração de verdade acontece.
  const conferir = useCallback(async () => {
    const [w, e] = await Promise.allSettled([buscarSituacao(), buscarSituacaoEmail()]);
    if (w.status === 'fulfilled') setWhatsapp(w.value);
    if (e.status === 'fulfilled') setEmail(e.value);
  }, []);

  useEffect(() => {
    void conferir();
  }, [conferir]);

  const CANAIS = [
    { chave: 'whatsapp' as const, rotulo: 'WhatsApp', leitura: lerWhatsApp(whatsapp) },
    { chave: 'email' as const, rotulo: 'E-mail', leitura: lerEmail(email) },
  ];

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Comunicação"
          descricao={
            <>O convite de cotação e o pedido de compra chegando até quem vai vender.</>
          }
        />

        <ul className="canais">
          {CANAIS.map((c) => (
            <li key={c.chave} className="canais__item">
              <div className="canais__topo">
                <strong className="canais__nome">{c.rotulo}</strong>
                <Selo tipo={c.leitura.tipo}>{c.leitura.texto}</Selo>
              </div>
              {c.leitura.detalhe && <p className="canais__detalhe">{c.leitura.detalhe}</p>}
            </li>
          ))}
        </ul>

        <div className="abas" role="tablist" aria-label="Canais de envio">
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
